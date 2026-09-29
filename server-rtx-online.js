/**
 * Online RTX optimizer service — first working backend (2026-09-29).
 *
 * The validated pipeline (tools/rtx-pipeline.js) behind a job-based web API:
 *
 *   POST /api/jobs          upload a video (multipart field "video", max 600 MB)
 *                           -> { id }
 *   GET  /api/jobs/:id      -> { status: queued|processing|done|failed, ... }
 *   GET  /api/jobs/:id/download  -> the optimized MP4, then files are deleted
 *   GET  /health            -> { ok, ffmpeg, node }
 *   GET  /                  -> mobile-friendly upload page (public/)
 *
 * Storage policy (ONLINE-SERVICE-PLAN.md):
 * - Jobs live in ./jobs/<random id>/ (outside the web root), never served
 *   directly; downloads stream through the API.
 * - Successful download deletes the whole job directory.
 * - A cleanup timer deletes abandoned/failed jobs older than JOB_TTL_MS.
 * - One job processes at a time; extra uploads wait in "queued".
 *
 * Security: random 32-hex job ids validated on every request, no shell
 * interpolation (spawn argument arrays), upload size capped by multer,
 * output paths derived only from the server-generated job id.
 * TODO before public exposure: HTTPS via reverse proxy + an access token.
 */
import express from 'express';
import multer from 'multer';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, rm, stat, rename, copyFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE_TOOL = path.join(ROOT, 'tools', 'rtx-pipeline.js');
const JOBS_DIR = path.join(ROOT, 'jobs');
const PUBLIC_DIR = path.join(ROOT, 'public');

const PORT = Number(process.env.PORT || 3005);
const MAX_FILE_SIZE = 600 * 1024 * 1024;      // 600 MB upload limit
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS || 60 * 60 * 1000); // 1 hour
const MIN_FREE_DISK = 2 * 1024 * 1024 * 1024; // need ~2 GB free to accept
const CLEANUP_INTERVAL_MS = 60 * 1000;

await mkdir(JOBS_DIR, { recursive: true });

// No job state survives a restart: purge any orphaned job directories left by
// a previous crash or restart (they are unreachable and would leak disk).
{
  const { readdir } = await import('node:fs/promises');
  const orphans = await readdir(JOBS_DIR).catch(() => []);
  for (const name of orphans) {
    if (/^[0-9a-f]{32}$/.test(name)) {
      await rm(path.join(JOBS_DIR, name), { recursive: true, force: true }).catch(() => {});
      console.log(`[startup] removed orphaned job ${name}`);
    }
  }
}

const upload = multer({
  dest: path.join(tmpdir(), 'vague-rtx-uploads-'),
  limits: { fileSize: MAX_FILE_SIZE },
});

const app = express();
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Job store (in memory; the jobs directory is the source of truth on disk)
// ---------------------------------------------------------------------------

/** @type {Map<string, job>} */
const jobs = new Map();
let processing = false;

function newJobId() {
  return randomBytes(16).toString('hex');
}

/** Move a file, falling back to copy+delete when rename crosses devices. */
async function moveFile(from, to) {
  try {
    await rename(from, to);
  } catch {
    await copyFile(from, to);
    await unlink(from).catch(() => {});
  }
}

/** Free disk bytes for a path (portable df), or null if unavailable. */
function freeDiskBytes(dirPath) {
  try {
    const res = spawnSync('df', ['-kP', dirPath], { encoding: 'utf8' });
    if (res.status !== 0) return null;
    const lines = res.stdout.trim().split('\n');
    const cols = lines[lines.length - 1].split(/\s+/);
    const freeKb = Number(cols[3]);
    return Number.isFinite(freeKb) ? freeKb * 1024 : null;
  } catch {
    return null;
  }
}

function validJobId(id) {
  return typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    inputBytes: job.inputBytes ?? null,
    outputBytes: job.outputBytes ?? null,
    error: job.error ?? null,
  };
}

async function removeJob(job) {
  jobs.delete(job.id);
  await rm(job.dir, { recursive: true, force: true }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Worker: runs the validated pipeline one job at a time
// ---------------------------------------------------------------------------

function startNextJob() {
  if (processing) return;
  const job = [...jobs.values()].find((j) => j.status === 'queued');
  if (!job) return;

  processing = true;
  job.status = 'processing';
  job.startedAt = Date.now();
  console.log(`[job ${job.id}] processing started (${job.inputBytes} bytes)`);

  const child = spawn(process.execPath, [PIPELINE_TOOL, job.inputPath, job.outputPath], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });

  child.on('error', (err) => {
    job.status = 'failed';
    job.error = `worker error: ${err.message}`;
    processing = false;
    console.error(`[job ${job.id}] failed to start: ${err.message}`);
  });

  child.on('close', (code) => {
    processing = false;
    if (code === 0 && existsSync(job.outputPath)) {
      job.status = 'done';
      stat(job.outputPath)
        .then((s) => { job.outputBytes = s.size; })
        .catch(() => {});
      console.log(`[job ${job.id}] done`);
    } else {
      job.status = 'failed';
      job.error = (stderr || stdout || `pipeline exited with code ${code}`).split('\n').filter(Boolean).slice(-6).join(' | ');
      console.error(`[job ${job.id}] failed (code ${code})`);
    }
    startNextJob();
  });
}

// ---------------------------------------------------------------------------
// Cleanup timer: delete abandoned jobs (queued/processing/done) past the TTL
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const job of [...jobs.values()]) {
    if (now - job.createdAt > JOB_TTL_MS) {
      console.log(`[job ${job.id}] expired after ${Math.round((now - job.createdAt) / 60000)} min — deleting`);
      removeJob(job);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', async (_req, res) => {
  const ff = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
  res.json({
    ok: true,
    service: 'rtx-online',
    ffmpeg: ff.status === 0 ? ff.stdout.split('\n')[0] : null,
    node: process.version,
    maxUploadBytes: MAX_FILE_SIZE,
    jobs: { total: jobs.size, processing },
  });
});

app.post('/api/jobs', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing video upload (multipart field "video").' });
    }
    if (!/\.(mp4|mov|m4v)$/i.test(req.file.originalname || '')) {
      await rm(req.file.path, { force: true }).catch(() => {});
      return res.status(400).json({ error: 'Only MP4/MOV/M4V files are supported.' });
    }

    const freeBytes = freeDiskBytes(JOBS_DIR);
    if (freeBytes !== null && freeBytes < MIN_FREE_DISK) {
      await rm(req.file.path, { force: true }).catch(() => {});
      return res.status(507).json({ error: 'Server is low on disk space, try again later.' });
    }

    const id = newJobId();
    const dir = path.join(JOBS_DIR, id);
    await mkdir(dir, { recursive: true });

    const inputPath = path.join(dir, 'input.mp4');
    await moveFile(req.file.path, inputPath);

    const job = {
      id,
      dir,
      inputPath,
      outputPath: path.join(dir, 'output.mp4'),
      status: 'queued',
      createdAt: Date.now(),
      inputBytes: req.file.size,
      outputBytes: null,
      error: null,
    };
    jobs.set(id, job);
    console.log(`[job ${id}] queued (${job.inputBytes} bytes, ${jobs.size} total)`);

    startNextJob();
    res.status(201).json({ id });
  } catch (error) {
    console.error('upload handler failed:', error);
    if (req.file) await rm(req.file.path, { force: true }).catch(() => {});
    res.status(500).json({ error: 'Could not store the upload.' });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  if (!validJobId(req.params.id)) return res.status(400).json({ error: 'Bad job id.' });
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Unknown job.' });
  res.json(publicJob(job));
});

app.get('/api/jobs/:id/download', (req, res) => {
  if (!validJobId(req.params.id)) return res.status(400).json({ error: 'Bad job id.' });
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Unknown job.' });
  if (job.status !== 'done') return res.status(409).json({ error: `Job is ${job.status}, not done.` });

  res.download(job.outputPath, 'optimized.mp4', (error) => {
    if (error) {
      console.error(`[job ${job.id}] download failed: ${error.message}`);
      return;
    }
    console.log(`[job ${job.id}] downloaded — deleting job files`);
    removeJob(job);
  });
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Video exceeds the 600 MB limit.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.use(express.static(PUBLIC_DIR));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`RTX online service listening on http://0.0.0.0:${PORT}`);
  console.log(`Pipeline: ${PIPELINE_TOOL}`);
  console.log(`Jobs dir: ${JOBS_DIR} (TTL ${Math.round(JOB_TTL_MS / 60000)} min)`);
});
