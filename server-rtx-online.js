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
 * Access token: set ACCESS_TOKEN in the environment -> every /api request
 *   must send it (header "x-access-token" or ?token=...). Unset = open
 *   (development only). HTTPS is still required before real exposure (see
 *   DEPLOY.md - Caddy reverse proxy).
 * Processing timeout: PROCESS_TIMEOUT_MS (default 30 min) kills stuck jobs.
 * Cancellation: DELETE /api/jobs/:id kills a running job and deletes files.
 * Progress: the worker reports "progress N stage" lines; GET /api/jobs/:id
 *   returns { progress, stage }.
 */
import express from 'express';
import multer from 'multer';
import { spawn, spawnSync, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, rm, stat, rename, copyFile, unlink, link, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE_TOOL = path.join(ROOT, 'tools', 'rtx-pipeline.js');
const JOBS_DIR = path.join(ROOT, 'jobs');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const MAX_CHUNK = 64 * 1024 * 1024;           // per-chunk cap for resumable uploads

const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const PROCESS_TIMEOUT_MS = Number(process.env.PROCESS_TIMEOUT_MS || 30 * 60 * 1000);
const PORT = Number(process.env.PORT || 3005);
const MAX_FILE_SIZE = 600 * 1024 * 1024;      // 600 MB upload limit
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS || 60 * 60 * 1000); // 1 hour
const MIN_FREE_DISK = 2 * 1024 * 1024 * 1024; // need ~2 GB free to accept
const CLEANUP_INTERVAL_MS = 60 * 1000;

await mkdir(JOBS_DIR, { recursive: true });
await mkdir(UPLOADS_DIR, { recursive: true });

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
    mode: job.mode ?? 'hdr',
    result: job.result ?? null,
    progress: job.progress ?? 0,
    stage: job.stage ?? null,
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
// Resumable uploads: the client sends the video in chunks, can pause, cancel and
// later continue from the byte where it stopped (nothing is re-uploaded).
// ---------------------------------------------------------------------------

const uploadsBusy = new Set();

function uploadPaths(id) {
  return {
    data: path.join(UPLOADS_DIR, id + '.bin'),
    meta: path.join(UPLOADS_DIR, id + '.json'),
    part: path.join(UPLOADS_DIR, id + '.part'),
  };
}

async function readUpload(id) {
  const p = uploadPaths(id);
  try {
    const meta = JSON.parse(await readFile(p.meta, 'utf8'));
    const st = await stat(p.data).catch(() => null);
    return { ...meta, received: st ? st.size : 0 };
  } catch {
    return null;
  }
}

async function removeUpload(id) {
  const p = uploadPaths(id);
  await Promise.all([p.data, p.meta, p.part].map((f) => rm(f, { force: true }).catch(() => {})));
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
  job.progress = 0;
  job.stage = 'starting';
  job.startedAt = Date.now();
  console.log(`[job ${job.id}] processing started (${job.inputBytes} bytes)`);

  const workerArgs = [PIPELINE_TOOL, job.inputPath, job.outputPath];
  if (job.mode === 'standard') workerArgs.push('--keep-dv');

  const child = spawn(process.execPath, workerArgs, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  job.child = child;

  const timeout = setTimeout(() => {
    if (job.status === 'processing') {
      job.timedOut = true;
      console.error(`[job ${job.id}] processing timeout after ${Math.round(PROCESS_TIMEOUT_MS / 60000)} min — killing`);
      child.kill('SIGTERM');
    }
  }, PROCESS_TIMEOUT_MS);

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => {
    stderr += d;
    // progress lines look like: "progress 45 timed"
    const chunk = d.toString();
    const m = chunk.match(/progress (\d+) ([a-z ]+)/i);
    if (m) {
      job.progress = Number(m[1]);
      job.stage = m[2].trim();
    }
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    job.status = 'failed';
    job.error = `worker error: ${err.message}`;
    job.child = null;
    processing = false;
    console.error(`[job ${job.id}] failed to start: ${err.message}`);
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    processing = false;
    job.child = null;
    if (code === 0 && existsSync(job.outputPath)) {
      job.status = 'done';
      job.progress = 100;
      job.stage = 'done';
      // Machine-readable summary from the pipeline (single PIPELINE_RESULT line)
      const line = stdout.split('\n').find((l) => l.startsWith('PIPELINE_RESULT '));
      if (line) {
        try { job.result = JSON.parse(line.slice('PIPELINE_RESULT '.length)); } catch {}
      }
      stat(job.outputPath)
        .then((s) => { job.outputBytes = s.size; })
        .catch(() => {});
      console.log(`[job ${job.id}] done (mode ${job.mode})`);
    } else if (job.cancelled) {
      console.log(`[job ${job.id}] cancelled — deleting`);
      removeJob(job);
    } else if (job.timedOut) {
      job.status = 'failed';
      job.error = `processing timeout after ${Math.round(PROCESS_TIMEOUT_MS / 60000)} min`;
      console.error(`[job ${job.id}] failed (timeout)`);
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
  // abandoned resumable uploads (paused/cancelled and never continued)
  readdir(UPLOADS_DIR).then(async (names) => {
    for (const name of names) {
      const m = /^([0-9a-f]{32})\.json$/.exec(name);
      if (!m) continue;
      const st = await stat(path.join(UPLOADS_DIR, name)).catch(() => null);
      if (st && now - st.mtimeMs > JOB_TTL_MS && !uploadsBusy.has(m[1])) {
        console.log(`[upload ${m[1]}] expired — deleting`);
        removeUpload(m[1]);
      }
    }
  }).catch(() => {});
}, CLEANUP_INTERVAL_MS).unref();

// ---------------------------------------------------------------------------
// Access token guard (when ACCESS_TOKEN is set)
// ---------------------------------------------------------------------------

app.use('/api', (req, res, next) => {
  if (!ACCESS_TOKEN) return next();
  const given = req.headers['x-access-token'] || req.query.token;
  if (given !== ACCESS_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — wrong or missing access token.' });
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Name of the Wi-Fi network the computer running this server is connected to (browsers cannot read their own).
let netCache = { at: 0, value: null };
function runCmd(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 2500, windowsHide: true }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });
}
async function readWifiName() {
  try {
    if (process.platform === 'win32') {
      const out = await runCmd('netsh', ['wlan', 'show', 'interfaces']);
      const m = /^\s*SSID\s*:\s*(.+?)\s*$/m.exec(out);
      return m ? m[1] : null;
    }
    if (process.platform === 'darwin') {
      const out = await runCmd('networksetup', ['-getairportnetwork', 'en0']);
      const m = /Current Wi-Fi Network:\s*(.+?)\s*$/m.exec(out);
      return m ? m[1] : null;
    }
    const iw = (await runCmd('iwgetid', ['-r'])).trim();
    if (iw) return iw;
    const nm = await runCmd('nmcli', ['-t', '-f', 'active,ssid', 'dev', 'wifi']);
    const line = nm.split('\n').find((l) => l.startsWith('yes:'));
    return line ? line.slice(4).replace(/\\:/g, ':').trim() || null : null;
  } catch {
    return null;
  }
}
app.get('/api/network', async (_req, res) => {
  if (Date.now() - netCache.at > 10000) netCache = { at: Date.now(), value: await readWifiName() };
  const ssid = netCache.value ? String(netCache.value).slice(0, 64) : null;
  res.json({ ssid, wired: !ssid });
});

// --- TikTok Inspector (read-only): probes an uploaded video, then deletes it immediately ---
const INSPECT_DIR = path.join(ROOT, 'inspect-tmp');
await mkdir(INSPECT_DIR, { recursive: true });
const inspectUpload = multer({ dest: INSPECT_DIR, limits: { fileSize: MAX_FILE_SIZE } });
app.post('/api/inspect', inspectUpload.single('video'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No video received.' });
  try {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file.path],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (p.status !== 0) return res.status(422).json({ error: 'Could not read this file as a video.' });
    return res.json({ probe: JSON.parse(p.stdout || '{}') });
  } catch {
    return res.status(500).json({ error: 'Inspect failed.' });
  } finally {
    unlink(file.path).catch(() => { /* already gone */ });
  }
});

app.get('/health', async (_req, res) => {
  const ff = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
  res.json({
    ok: true,
    service: 'rtx-online',
    ffmpeg: ff.status === 0 ? ff.stdout.split('\n')[0] : null,
    node: process.version,
    maxUploadBytes: MAX_FILE_SIZE,
    auth: ACCESS_TOKEN ? 'token' : 'open',
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
    const mode = req.body?.mode === 'standard' ? 'standard' : 'hdr';
    req.mode = mode;

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
      mode: req.mode,
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

app.post('/api/uploads', express.json({ limit: '10kb' }), async (req, res) => {
  try {
    const name = String(req.body?.name || '');
    const size = Number(req.body?.size);
    if (!/\.(mp4|mov|m4v)$/i.test(name)) return res.status(400).json({ error: 'Only MP4/MOV/M4V files are supported.' });
    if (!Number.isInteger(size) || size < 1) return res.status(400).json({ error: 'Bad file size.' });
    if (size > MAX_FILE_SIZE) return res.status(413).json({ error: 'File is bigger than 600 MB.' });
    const freeBytes = freeDiskBytes(UPLOADS_DIR);
    if (freeBytes !== null && freeBytes < MIN_FREE_DISK) return res.status(507).json({ error: 'Server is low on disk space, try again later.' });
    const id = newJobId();
    const p = uploadPaths(id);
    await writeFile(p.meta, JSON.stringify({ id, name: path.basename(name), size, createdAt: Date.now() }));
    await writeFile(p.data, '');
    res.status(201).json({ id, size, received: 0 });
  } catch (error) {
    console.error('create upload failed:', error);
    res.status(500).json({ error: 'Could not start the upload.' });
  }
});

app.get('/api/uploads/:id', async (req, res) => {
  if (!validJobId(req.params.id)) return res.status(400).json({ error: 'Bad upload id.' });
  const up = await readUpload(req.params.id);
  if (!up) return res.status(404).json({ error: 'Unknown upload.' });
  res.json({ id: up.id, name: up.name, size: up.size, received: up.received });
});

app.put('/api/uploads/:id', async (req, res) => {
  const id = req.params.id;
  if (!validJobId(id)) return res.status(400).json({ error: 'Bad upload id.' });
  const up = await readUpload(id);
  if (!up) return res.status(404).json({ error: 'Unknown upload.' });
  const offset = Number(req.query.offset);
  if (!Number.isInteger(offset) || offset !== up.received) {
    return res.status(409).json({ error: 'Offset mismatch.', received: up.received });
  }
  const len = Number(req.headers['content-length']);
  if (!Number.isFinite(len) || len < 1 || len > MAX_CHUNK || offset + len > up.size) {
    return res.status(400).json({ error: 'Bad chunk size.' });
  }
  if (uploadsBusy.has(id)) return res.status(409).json({ error: 'Chunk already in progress.', received: up.received });
  uploadsBusy.add(id);
  const p = uploadPaths(id);
  try {
    await pipeline(req, createWriteStream(p.part));
    const st = await stat(p.part);
    if (st.size !== len) throw new Error('short chunk');
    await pipeline(createReadStream(p.part), createWriteStream(p.data, { flags: 'a' }));
    const now = new Date();
    await import('node:fs/promises').then(({ utimes }) => utimes(p.meta, now, now)).catch(() => {});
    if (!res.headersSent) res.json({ received: offset + len });
  } catch {
    const cur = await readUpload(id);
    if (!res.headersSent && !res.destroyed) res.status(400).json({ error: 'Chunk failed.', received: cur ? cur.received : 0 });
  } finally {
    uploadsBusy.delete(id);
    await rm(p.part, { force: true }).catch(() => {});
  }
});

app.post('/api/uploads/:id/start', express.json({ limit: '10kb' }), async (req, res) => {
  try {
    const uploadId = req.params.id;
    if (!validJobId(uploadId)) return res.status(400).json({ error: 'Bad upload id.' });
    const up = await readUpload(uploadId);
    if (!up) return res.status(404).json({ error: 'Unknown upload.' });
    if (up.received !== up.size) return res.status(409).json({ error: 'Upload is not complete.', received: up.received });
    const mode = req.body?.mode === 'standard' ? 'standard' : 'hdr';

    const id = newJobId();
    const dir = path.join(JOBS_DIR, id);
    await mkdir(dir, { recursive: true });
    const inputPath = path.join(dir, 'input.mp4');
    // hard link: the same bytes stay available for another run without re-uploading
    await link(uploadPaths(uploadId).data, inputPath).catch(() => copyFile(uploadPaths(uploadId).data, inputPath));

    const job = {
      id, dir, inputPath, uploadId,
      outputPath: path.join(dir, 'output.mp4'),
      status: 'queued', mode, createdAt: Date.now(),
      inputBytes: up.size, outputBytes: null, error: null,
    };
    jobs.set(id, job);
    console.log(`[job ${id}] queued from upload ${uploadId} (${up.size} bytes, ${jobs.size} total)`);
    startNextJob();
    res.status(201).json({ id });
  } catch (error) {
    console.error('start from upload failed:', error);
    res.status(500).json({ error: 'Could not start optimizing.' });
  }
});

app.delete('/api/uploads/:id', async (req, res) => {
  if (!validJobId(req.params.id)) return res.status(400).json({ error: 'Bad upload id.' });
  await removeUpload(req.params.id);
  res.json({ id: req.params.id, status: 'deleted' });
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
    if (job.uploadId) removeUpload(job.uploadId);
  });
});

app.delete('/api/jobs/:id', (req, res) => {
  if (!validJobId(req.params.id)) return res.status(400).json({ error: 'Bad job id.' });
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Unknown job.' });

  if (job.status === 'processing' && job.child) {
    job.cancelled = true;
    job.child.kill('SIGTERM'); // the close handler deletes the job files
    console.log(`[job ${job.id}] cancel requested`);
    return res.json({ id: job.id, status: 'cancelling' });
  }

  removeJob(job);
  console.log(`[job ${job.id}] deleted`);
  res.json({ id: job.id, status: 'deleted' });
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
