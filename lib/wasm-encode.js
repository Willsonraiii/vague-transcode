// lib/wasm-encode.js
// Browser-local FFmpeg operations. The default path is stream-copy remuxing:
// FFmpeg rebuilds the MP4 container without decoding video, so HDR, 10-bit and
// Dolby Vision samples remain untouched. CFR encoding is reserved for 8-bit VFR
// input because a browser x265 re-encode cannot safely preserve Dolby Vision.
//
// Uses the single-threaded @ffmpeg/core (0.12.x) — no COOP/COEP headers
// needed, matches the constraint you already chose for Obi.

import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';

const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

let ffmpeg = null;
let loadingPromise = null;

async function ensureLoaded(onProgress) {
  if (ffmpeg) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const instance = new FFmpeg();
    instance.on('log', ({ message }) => onProgress && onProgress(0, message));
    instance.on('progress', ({ progress }) => {
      onProgress && onProgress(Math.round(progress * 100), 'Encoding');
    });
    // The wrapper is imported from jsDelivr, so its default Worker URL is
    // cross-origin and GitHub Pages blocks it. Use a vendored, same-origin
    // copy of the FFmpeg worker instead. Its two tiny dependencies live beside
    // it in lib/ffmpeg-const.js and lib/ffmpeg-errors.js.
    const classWorkerURL = new URL('./lib/ffmpeg-worker.js', window.location.href).href;
    await instance.load({
      classWorkerURL,
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpeg = instance;
    return instance;
  })();

  return loadingPromise;
}

/**
 * Lock a variable-frame-rate file to constant frame rate.
 * Re-encodes video (audio stream-copied when possible). Preserves the
 * source's colour tags (primaries/transfer/matrix) so HDR signalling
 * survives the transcode — Dolby Vision RPU does NOT survive this path;
 * if the source has DV, tell the user to use the server pipeline instead.
 *
 * @param {File} file
 * @param {object} probe - the object returned by probeFile() in probe.js
 *   (needs fps, colorPrimaries, colorTransfer, colorMatrix, hasDolbyVisionRPU)
 * @param {(pct:number, label:string)=>void} onProgress
 * @param {{targetFps?:number}} opts
 * @returns {Promise<{blob: Blob, droppedDV: boolean}>}
 */
export async function lockCFR(file, probe, onProgress, opts = {}) {
  if (probe.hasDolbyVisionRPU) {
    // Loud, not silent — this path WILL drop DV. Caller should confirm
    // with the user or route to the server pipeline instead.
    onProgress && onProgress(0, 'Warning: Dolby Vision RPU will not survive this encode');
  }

  const engine = await ensureLoaded(onProgress);
  const inputName = 'in' + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4');
  const outputName = 'out.mp4';

  await engine.writeFile(inputName, await fetchFile(file));

  const targetFps = opts.targetFps || Math.round(probe.fps) || 30;

  const colorArgs = [];
  if (probe.colorPrimaries) colorArgs.push('-color_primaries', probe.colorPrimaries);
  if (probe.colorTransfer) colorArgs.push('-color_trc', probe.colorTransfer);
  if (probe.colorMatrix) colorArgs.push('-colorspace', probe.colorMatrix);

  const args = [
    '-i', inputName,
    '-vsync', 'cfr',
    '-r', String(targetFps),
    '-c:v', probe.bitDepth >= 10 ? 'libx265' : 'libx264',
    ...(probe.bitDepth >= 10 ? ['-pix_fmt', 'yuv420p10le', '-tag:v', 'hvc1'] : ['-tag:v', 'avc1']),
    '-crf', '16',
    '-preset', 'medium',
    ...colorArgs,
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputName,
  ];

  await engine.exec(args);

  const data = await engine.readFile(outputName);
  await engine.deleteFile(inputName);
  await engine.deleteFile(outputName);

  return {
    blob: new Blob([data.buffer], { type: 'video/mp4' }),
    reencoded: true,
    droppedDV: !!probe.hasDolbyVisionRPU,
  };
}

/**
 * RTXFury-derived timing method for a 60 fps source.
 *
 * Copies the encoded HEVC/AAC packets. It doubles input timestamps and writes
 * the video track with a 19200 timebase, so 60 source samples are presented
 * over roughly twice the normal timeline and are declared as about 30 fps.
 * No zero-duration patch and no video re-encode are used here.
 */
export async function rtxTimingWithFFmpeg(file, probe, onProgress, opts = {}) {
  const engine = await ensureLoaded(onProgress);
  const inputName = 'rtx-input' + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4');
  const outputName = 'rtx-output.mp4';
  const factor = Number(opts.factor) > 0 ? Number(opts.factor) :
    (probe.fps > 90 ? 4 : probe.fps > 48 ? 2 : 1);
  let written = false;

  try {
    onProgress?.(0, 'Loading FFmpeg');
    await engine.writeFile(inputName, await fetchFile(file));
    written = true;
    onProgress?.(10, `Applying RTX timing ${factor}x`);
    await engine.exec([
      '-itsscale', String(factor),
      '-i', inputName,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-video_track_timescale', '19200',
      '-brand', 'isom',
      '-movflags', '+faststart',
      outputName
    ]);
    const data = await engine.readFile(outputName);
    onProgress?.(100, 'Optimization finished');
    return { blob: new Blob([data.buffer], { type: 'video/mp4' }), factor, reencoded: false };
  } finally {
    if (written) { try { await engine.deleteFile(inputName); } catch {} }
    try { await engine.deleteFile(outputName); } catch {}
  }
}

/**
 * Run a lossless FFmpeg remux in the browser. This is the default optimizer:
 * FFmpeg copies every encoded sample and audio packet, while rebuilding the
 * MP4 container with the index at the front. HDR, 10-bit and Dolby Vision are
 * not decoded or re-encoded on this path.
 *
 * @param {File} file
 * @param {(pct:number, label:string)=>void} onProgress
 * @returns {Promise<{blob: Blob, reencoded: false}>}
 */
export async function remuxWithFFmpeg(file, onProgress) {
  const engine = await ensureLoaded(onProgress);
  const inputName = 'input' + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4');
  const outputName = 'optimized.mp4';
  let written = false;

  try {
    onProgress?.(0, 'Loading video into FFmpeg');
    await engine.writeFile(inputName, await fetchFile(file));
    written = true;

    onProgress?.(10, 'Remuxing without re-encoding');
    await engine.exec([
      '-i', inputName,
      '-map', '0',
      '-c', 'copy',
      '-movflags', '+faststart',
      outputName
    ]);

    const data = await engine.readFile(outputName);
    onProgress?.(100, 'Finished');
    return {
      blob: new Blob([data.buffer], { type: 'video/mp4' }),
      reencoded: false
    };
  } finally {
    if (written) {
      try { await engine.deleteFile(inputName); } catch {}
    }
    try { await engine.deleteFile(outputName); } catch {}
  }
}

/**
 * Pick the safe browser operation. HDR/10-bit/Dolby Vision always use a
 * stream-copy remux so quality and dynamic metadata cannot be lost.
 * An 8-bit VFR file may use the CFR encoder when requested.
 */
export async function optimizeWithFFmpeg(file, probe, onProgress, opts = {}) {
  if (probe.bitDepth >= 10 || probe.hasDolbyVisionRPU || !probe.vfr) {
    return remuxWithFFmpeg(file, onProgress);
  }
  return lockCFR(file, probe, onProgress, opts);
}
