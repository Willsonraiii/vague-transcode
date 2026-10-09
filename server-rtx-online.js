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
import { mkdir, rm, stat, rename, copyFile, unlink, link, readFile, writeFile, readdir, utimes, truncate } from 'node:fs/promises';
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
    preset: job.preset ?? 'original',
    result: job.result ?? null,
    progress: job.progress ?? 0,
    stage: job.stage ?? null,
    createdAt: job.createdAt,
    inputBytes: job.inputBytes ?? null,
    outputBytes: job.outputBytes ?? null,
    error: job.error ?? null,
    log: job.log ?? [],
    probeIn: job.probeIn ?? null,
    probeOut: job.probeOut ?? null,
  };
}

async function removeJob(job) {
  jobs.delete(job.id);
  await rm(job.dir, { recursive: true, force: true }).catch(() => {});
  if (job.uploadId) await removeUpload(job.uploadId).catch(() => {});
}

// ---------------------------------------------------------------------------
// Resumable uploads: the client sends the video in chunks, can pause, cancel and
// later continue from the byte where it stopped (nothing is re-uploaded).
// ---------------------------------------------------------------------------

const uploadsActive = new Map();

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
  const gradeLabel = job.preset && job.preset !== 'original' ? ` · preset ${job.preset}` : ' · pure lossless';
  job.log = [`[obito] optimizing ${job.fileName || 'video'} · mode ${job.mode}${gradeLabel}`];
  job.probeIn = summarizeProbe(probeFile(job.inputPath));
  if (job.probeIn) logLine(job, `[obito] source: ${job.probeIn.w}x${job.probeIn.h} · ${job.probeIn.fps} fps · ${job.probeIn.codec}${job.probeIn.transfer && job.probeIn.transfer !== 'unknown' ? ' · ' + job.probeIn.transfer : ''}`);
  job.startedAt = Date.now();
  console.log(`[job ${job.id}] processing started (${job.inputBytes} bytes, mode ${job.mode}${gradeLabel})`);

  const workerArgs = ['--expose-gc', '--max-old-space-size=180', PIPELINE_TOOL, job.inputPath, job.outputPath];
  if (job.mode === 'standard') workerArgs.push('--keep-dv');
  if (job.preset && job.preset !== 'original') workerArgs.push('--grade', job.preset);

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
      logLine(job, `[obito] ${m[1]}% — ${m[2].trim()}`);
    } else {
      chunk.split('\n').map((s) => s.trim()).filter(Boolean).slice(-4).forEach((l) => logLine(job, '[ff] ' + l));
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
      logLine(job, '[obito] repackaged — copy test & probe…');
      job.probeOut = summarizeProbe(probeFile(job.outputPath));
      logLine(job, `[obito] done ✓ output ${job.probeOut ? job.probeOut.w + 'x' + job.probeOut.h + ' · ' + job.probeOut.fps + ' fps' : ''}${job.probeOut?.dv ? ' · DV stripped' : ''}`);
      libAdd({ id: job.id, name: job.fileName || 'video', mode: job.mode, status: 'done', at: Date.now(), in: job.probeIn || null, out: job.probeOut || null, result: job.result || null }).catch(() => {});
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
      logLine(job, '[obito] failed — timeout');
      libAdd({ id: job.id, name: job.fileName || 'video', mode: job.mode, status: 'failed', at: Date.now(), in: job.probeIn || null, out: null, error: job.error }).catch(() => {});
      console.error(`[job ${job.id}] failed (timeout)`);
    } else {
      job.status = 'failed';
      job.error = (stderr || stdout || `pipeline exited with code ${code}`).split('\n').filter(Boolean).slice(-6).join(' | ');
      logLine(job, '[obito] failed — ' + (job.error || 'unknown'));
      libAdd({ id: job.id, name: job.fileName || 'video', mode: job.mode, status: 'failed', at: Date.now(), in: job.probeIn || null, out: null, error: job.error }).catch(() => {});
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
      if (st && now - st.mtimeMs > JOB_TTL_MS && !uploadsActive.has(m[1])) {
        console.log(`[upload ${m[1]}] expired — deleting`);
        removeUpload(m[1]);
      }
    }
  }).catch(() => {});
}, CLEANUP_INTERVAL_MS).unref();

// ---------------------------------------------------------------------------
// Access token guard (when ACCESS_TOKEN is set)
// ---------------------------------------------------------------------------

// Wrong-key attempts are counted per client; too many in a row locks that client out for a while,
// so a short, easy access key is still safe on a public link.
const failedKeyAttempts = new Map(); // client -> { count, first, lockedUntil }
const KEY_MAX_FAILS = 8;
const KEY_WINDOW_MS = 10 * 60 * 1000;
const KEY_LOCK_MS = 10 * 60 * 1000;
function clientId(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket.remoteAddress || 'unknown';
}
setInterval(() => {
  const now = Date.now();
  for (const [id, f] of failedKeyAttempts) if (now - f.first > KEY_WINDOW_MS && now > f.lockedUntil) failedKeyAttempts.delete(id);
}, 60 * 1000).unref();
app.use('/api', (req, res, next) => {
  if (!ACCESS_TOKEN) return next();
  const id = clientId(req);
  const rec = failedKeyAttempts.get(id);
  if (rec && Date.now() < rec.lockedUntil) {
    res.set('Retry-After', String(Math.ceil((rec.lockedUntil - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many wrong keys. Try again in a few minutes.' });
  }
  const given = String(req.headers['x-access-token'] || req.query.token || '');
  if (given !== ACCESS_TOKEN) {
    if (given) { // only real wrong guesses count; a missing key (page not unlocked yet) does not
      const now = Date.now();
      const r = rec && now - rec.first <= KEY_WINDOW_MS ? rec : { count: 0, first: now, lockedUntil: 0 };
      r.count += 1;
      if (r.count >= KEY_MAX_FAILS) r.lockedUntil = now + KEY_LOCK_MS;
      failedKeyAttempts.set(id, r);
    }
    return res.status(401).json({ error: 'Unauthorized — wrong or missing access token.' });
  }
  if (rec) failedKeyAttempts.delete(id);
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

// --- TikTok Inspector by LINK: username via oEmbed, page metadata, then download+probe for full detail ---
const TIKTOK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
app.post('/api/inspect-link', express.json({ limit: '10kb' }), async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!/^https?:\/\/([a-z0-9-]+\.)*tiktok\.com\//i.test(url)) return res.status(400).json({ error: 'Paste a full TikTok link (https://www.tiktok.com/…).' });
  const out = { user: null, title: null, page: null, probe: null, note: null };
  try {
    const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), { headers: { 'user-agent': TIKTOK_UA }, signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j = await r.json(); if (j.author_unique_id) out.user = '@' + j.author_unique_id; out.title = j.title || null; }
  } catch { /* oEmbed optional */ }
  let videoUrl = null;
  try {
    const r = await fetch(url, { headers: { 'user-agent': TIKTOK_UA, 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    const html = await r.text();
    const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/.exec(html)
      || /<script id="SIGI_STATE" type="application\/json">([^<]+)<\/script>/.exec(html);
    if (m) {
      const data = JSON.parse(m[1]);
      const item = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
        || Object.values(data?.ItemModule || {}).find((v) => v && v.video) || null;
      const v = item?.video || null;
      if (v) {
        out.page = {
          width: v.width || null, height: v.height || null,
          duration: item?.video?.duration || v.duration || null,
          bitrate: v.bitrate || null, ratio: v.ratio || null,
          author: item?.author?.uniqueId || null,
          stats: item?.stats ? { plays: item.stats.playCount, likes: item.stats.diggCount, comments: item.stats.commentCount, shares: item.stats.shareCount } : null
        };
        if (out.page.author) out.user = out.user || '@' + out.page.author;
        videoUrl = v.downloadAddr || v.playAddr || (v.playApi ? 'https://' + v.playApi : null) || v.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] || null;
      }
    }
  } catch { /* page fetch optional */ }
  if (videoUrl) {
    try {
      const vr = await fetch(videoUrl, { headers: { 'user-agent': TIKTOK_UA, referer: 'https://www.tiktok.com/' }, signal: AbortSignal.timeout(60000) });
      if (vr.ok) {
        const buf = Buffer.from(await vr.arrayBuffer());
        if (buf.length > 100000 && buf.length <= MAX_FILE_SIZE) {
          const tmp = path.join(INSPECT_DIR, 'link-' + randomBytes(8).toString('hex') + '.mp4');
          await writeFile(tmp, buf);
          const p = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', tmp], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
          await unlink(tmp).catch(() => { /* already gone */ });
          if (p.status === 0) out.probe = JSON.parse(p.stdout || 'null');
        }
      }
    } catch { /* blocked */ }
    if (!out.probe) out.note = 'TikTok blocked the direct stream download — showing link info only. Drop the saved file for full fps/HDR/Dolby detail.';
  } else if (!out.page && !out.user) {
    out.note = 'Could not read this link (TikTok may block server requests). Drop the saved video file instead.';
  }
  res.json(out);
});

// --- Library: persistent metadata-only history + probes for the stats UI ---
const LIB_FILE = path.join(ROOT, 'library.json');
function probeFile(fp) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', fp], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (p.status !== 0) return null;
  try { return JSON.parse(p.stdout); } catch { return null; }
}
function summarizeProbe(probe) {
  if (!probe) return null;
  const streams = probe.streams || [];
  const v = streams.find((s) => s.codec_type === 'video') || null;
  const audio = streams.filter((s) => s.codec_type === 'audio');
  const fr = v?.r_frame_rate ? String(v.r_frame_rate).split('/') : null;
  const dovi = (v?.side_data_list || []).find((s) => /DOVI|Dolby/i.test(s.side_data_type || ''));
  return {
    w: v?.width || null, h: v?.height || null,
    fps: fr ? Math.round((Number(fr[0]) / (Number(fr[1]) || 1)) * 100) / 100 : null,
    codec: v?.codec_name || null, transfer: v?.color_transfer || null,
    dv: dovi ? (dovi.dv_profile ?? 1) : 0,
    audio: audio.length, dur: Math.round(Number(probe.format?.duration || 0)),
    size: Number(probe.format?.size || 0), ts: v?.time_base ? Number(String(v.time_base).split('/')[1]) : null
  };
}
async function libRead() { try { return JSON.parse(await readFile(LIB_FILE, 'utf8')); } catch { return []; } }
async function libWrite(list) { await writeFile(LIB_FILE, JSON.stringify(list)).catch(() => { /* disk full etc. */ }); }
async function libAdd(entry) {
  const list = await libRead();
  list.unshift(entry);
  await libWrite(list.slice(0, 60));
}

app.get('/api/library', async (_req, res) => res.json({ entries: await libRead() }));
app.post('/api/library/clear', async (_req, res) => { await libWrite([]); res.json({ ok: true }); });

function logLine(job, line) {
  if (!job.log) job.log = [];
  job.log.push(line);
  if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
}

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
      fileName: req.file?.originalname || null,
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
  res.json({ id: up.id, name: up.name, size: up.size, received: up.received, bytesReceived: up.received });
});

app.put('/api/uploads/:id', async (req, res) => {
  const id = req.params.id;
  if (!validJobId(id)) return res.status(400).json({ error: 'Bad upload id.' });
  const up = await readUpload(id);
  if (!up) return res.status(404).json({ error: 'Unknown upload.' });
  const offset = Number(req.query.offset);
  if (!Number.isInteger(offset)) return res.status(400).json({ error: 'Invalid offset.' });

  // If the server already received past or equal to this offset (e.g. duplicate retry after dropped ACK),
  // return success immediately so the client can advance without conflict.
  if (offset < up.received) {
    return res.json({ received: up.received, bytesReceived: up.received, synced: true });
  }

  // If offset skips ahead of received bytes, notify client of the actual received offset.
  if (offset > up.received) {
    return res.status(409).json({ error: 'Offset mismatch.', received: up.received, bytesReceived: up.received });
  }

  const rawLen = req.headers['content-length'];
  const expectedLen = rawLen !== undefined ? Number(rawLen) : null;
  if (expectedLen !== null && (!Number.isFinite(expectedLen) || expectedLen < 1 || expectedLen > MAX_CHUNK || offset + expectedLen > up.size)) {
    return res.status(400).json({ error: 'Bad chunk size.' });
  }

  // Terminate any previous hanging connection on this upload ID immediately so the client can proceed
  const prev = uploadsActive.get(id);
  if (prev && prev.req !== req) {
    try { prev.req.destroy(); } catch {}
    uploadsActive.delete(id);
  }
  uploadsActive.set(id, { req, res });
  req.setTimeout(90000, () => {
    try { req.destroy(new Error('Socket timeout')); } catch {}
  });

  const p = uploadPaths(id);
  try {
    await pipeline(req, createWriteStream(p.data, { flags: 'a' }));
    const st = await stat(p.data);
    const actualReceived = st.size;
    const actualLen = actualReceived - offset;
    if (actualLen < 1 || actualLen > MAX_CHUNK || actualReceived > up.size) {
      throw new Error(`invalid chunk size: got ${actualLen} bytes`);
    }
    if (expectedLen !== null && actualLen !== expectedLen) {
      throw new Error(`short chunk: expected ${expectedLen}, got ${actualLen}`);
    }
    const now = new Date();
    await utimes(p.meta, now, now).catch(() => {});
    if (!res.headersSent) res.json({ received: actualReceived, bytesReceived: actualReceived });
  } catch (err) {
    console.error(`[upload ${id}] chunk error at offset ${offset}:`, err?.message || err);
    // Truncate back to initial offset so any interrupted/partial chunk write is discarded
    await truncate(p.data, offset).catch(() => {});
    const cur = await readUpload(id);
    if (!res.headersSent && !res.destroyed) {
      res.status(400).json({ error: 'Chunk failed: ' + (err?.message || 'unknown'), received: cur ? cur.received : 0, bytesReceived: cur ? cur.received : 0 });
    }
  } finally {
    if (uploadsActive.get(id)?.req === req) {
      uploadsActive.delete(id);
    }
  }
});

app.post('/api/uploads/:id/probe', express.json({ limit: '10kb' }), async (req, res) => {
  const id = req.params.id;
  if (!validJobId(id)) return res.status(400).json({ error: 'Bad upload id.' });
  const up = await readUpload(id);
  if (!up) return res.status(404).json({ error: 'Unknown upload.' });
  if (up.received !== up.size) return res.status(409).json({ error: 'Upload is not complete.', received: up.received });
  res.json({ probe: summarizeProbe(probeFile(uploadPaths(id).data)) });
});

app.post('/api/uploads/:id/start', express.json({ limit: '10kb' }), async (req, res) => {
  try {
    const uploadId = req.params.id;
    if (!validJobId(uploadId)) return res.status(400).json({ error: 'Bad upload id.' });
    const up = await readUpload(uploadId);
    if (!up) return res.status(404).json({ error: 'Unknown upload.' });
    if (up.received !== up.size) return res.status(409).json({ error: 'Upload is not complete.', received: up.received });
    const mode = req.body?.mode === 'standard' ? 'standard' : 'hdr';
    const preset = String(req.body?.preset || 'original');

    const id = newJobId();
    const dir = path.join(JOBS_DIR, id);
    await mkdir(dir, { recursive: true });
    const inputPath = path.join(dir, 'input.mp4');
    // hard link: the same bytes stay available for another run without re-uploading
    await link(uploadPaths(uploadId).data, inputPath).catch(() => copyFile(uploadPaths(uploadId).data, inputPath));

    const job = {
      id, dir, inputPath, uploadId,
      outputPath: path.join(dir, 'output.mp4'),
      status: 'queued', mode, preset, createdAt: Date.now(),
      inputBytes: up.size, outputBytes: null, error: null,
      fileName: up.name || null,
    };
    jobs.set(id, job);
    console.log(`[job ${id}] queued from upload ${uploadId} (${up.size} bytes, preset ${preset}, ${jobs.size} total)`);
    startNextJob();
    res.status(201).json({ id });
  } catch (error) {
    console.error('start from upload failed:', error);
    res.status(500).json({ error: 'Could not start optimizing.' });
  }
});

app.post('/api/jobs/:id/grade', express.json({ limit: '10kb' }), async (req, res) => {
  try {
    const parentId = req.params.id;
    if (!validJobId(parentId)) return res.status(400).json({ error: 'Bad job id.' });
    const parent = jobs.get(parentId);
    if (!parent || parent.status !== 'done' || !existsSync(parent.outputPath)) {
      return res.status(404).json({ error: 'Original optimized video is no longer available.' });
    }
    const preset = String(req.body?.preset || 'vibrant');
    const id = newJobId();
    const dir = path.join(JOBS_DIR, id);
    await mkdir(dir, { recursive: true });
    const inputPath = path.join(dir, 'input.mp4');
    await link(parent.outputPath, inputPath).catch(() => copyFile(parent.outputPath, inputPath));

    const st = await stat(inputPath);
    const job = {
      id, dir, inputPath,
      outputPath: path.join(dir, 'output.mp4'),
      status: 'queued',
      mode: parent.mode || 'hdr',
      preset,
      createdAt: Date.now(),
      inputBytes: st.size,
      outputBytes: null,
      error: null,
      fileName: (parent.fileName ? parent.fileName.replace(/\.[^.]+$/, '') : 'video') + `-${preset}.mp4`,
    };
    jobs.set(id, job);
    console.log(`[job ${id}] queued grade (${preset}) from parent job ${parentId}`);
    startNextJob();
    res.status(201).json({ id });
  } catch (error) {
    console.error('grade job failed:', error);
    res.status(500).json({ error: 'Could not apply color grade.' });
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

app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-store'); },
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`RTX online service listening on http://0.0.0.0:${PORT}`);
  console.log(`Pipeline: ${PIPELINE_TOOL}`);
  console.log(`Jobs dir: ${JOBS_DIR} (TTL ${Math.round(JOB_TTL_MS / 60000)} min)`);
});
