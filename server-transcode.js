// server/transcode.js
// The ONLY way to re-encode a Dolby Vision file (change fps/bitrate/scale)
// without losing DV: pull the RPU out first with dovi_tool, encode the
// base layer with ffmpeg, then inject the RPU back into the new HEVC
// stream. A plain ffmpeg re-encode always drops the RPU.
//
// Requires on the server: ffmpeg (with libx265), dovi_tool, mp4muxer
// (or ffmpeg for the final mux — see below).
//   apt install ffmpeg
//   cargo install dovi_tool   (or download a release binary)
//
// Run as: node server/transcode.js  (Express, multipart upload -> job -> download)

import express from 'express';
import multer from 'multer';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const app = express();
const upload = multer({ dest: tmpdir(), limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB cap

// Allow your GitHub Pages / static site origin to call this server.
// Replace '*' with your actual site origin once you know it, e.g.
// 'https://willsonraiii.github.io'
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

function run(cmd, args, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d;
      onLine && onLine(d.toString());
    });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/**
 * Full pipeline: input -> (extract RPU) -> encode base layer -> inject RPU -> mux
 * @param {string} inputPath
 * @param {string} workDir
 * @param {{targetFps?:number, targetHeight?:number, hasDV:boolean, crf?:number}} opts
 * @returns {Promise<string>} path to final .mp4
 */
async function transcodePreservingDV(inputPath, workDir, opts) {
  const hevcRaw = path.join(workDir, 'base.hevc');
  const rpuFile = path.join(workDir, 'rpu.bin');
  const encodedHevc = path.join(workDir, 'encoded.hevc');
  const injectedHevc = path.join(workDir, 'injected.hevc');
  const finalMp4 = path.join(workDir, 'output.mp4');

  if (opts.hasDV) {
    // 1. Demux to raw HEVC (stream copy, no re-encode yet)
    await run('ffmpeg', ['-i', inputPath, '-c:v', 'copy', '-bsf:v', 'hevc_mp4toannexb', '-f', 'hevc', hevcRaw]);
    // 2. Pull the RPU (dynamic HDR metadata) out of the raw stream
    await run('dovi_tool', ['extract-rpu', hevcRaw, '-o', rpuFile]);
  }

  // 3. Re-encode the base layer with the actual quality/fps/scale changes.
  //    This is where real ffmpeg encoding happens — everything else here
  //    is just carrying the DV metadata across it.
  const vf = [];
  if (opts.targetFps) vf.push(`fps=${opts.targetFps}`);
  if (opts.targetHeight) vf.push(`scale=-2:${opts.targetHeight}`);

  await run('ffmpeg', [
    '-i', inputPath,
    ...(vf.length ? ['-vf', vf.join(',')] : []),
    '-c:v', 'libx265',
    '-pix_fmt', 'yuv420p10le',
    '-crf', String(opts.crf ?? 16),
    '-preset', 'slow',
    '-x265-params', 'hdr10=1:repeat-headers=1',
    '-color_primaries', 'bt2020',
    '-color_trc', 'smpte2084',
    '-colorspace', 'bt2020nc',
    '-an',
    '-bsf:v', 'hevc_mp4toannexb',
    '-f', 'hevc',
    opts.hasDV ? encodedHevc : injectedHevc,
  ]);

  if (opts.hasDV) {
    // 4. Inject the original RPU back into the freshly encoded stream
    await run('dovi_tool', ['inject-rpu', '-i', encodedHevc, '--rpu-in', rpuFile, '-o', injectedHevc]);
  }

  // 5. Mux video (with DV intact) back with audio (stream-copied) into MP4
  await run('ffmpeg', [
    '-i', injectedHevc,
    '-i', inputPath,
    '-map', '0:v:0', '-map', '1:a:0?',
    '-c:v', 'copy',
    '-tag:v', 'hvc1',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    finalMp4,
  ]);

  return finalMp4;
}

app.post('/api/transcode', upload.single('video'), async (req, res) => {
  const workDir = await mkdtemp(path.join(tmpdir(), 'obi-'));
  try {
    const opts = {
      hasDV: req.body.hasDV === 'true',
      targetFps: req.body.targetFps ? Number(req.body.targetFps) : undefined,
      targetHeight: req.body.targetHeight ? Number(req.body.targetHeight) : undefined,
      crf: req.body.crf ? Number(req.body.crf) : undefined,
    };
    const outPath = await transcodePreservingDV(req.file.path, workDir, opts);
    res.download(outPath, 'obi-transcoded.mp4', async () => {
      await rm(workDir, { recursive: true, force: true });
      await rm(req.file.path, { force: true });
    });
  } catch (err) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Transcode server on :3001'));
