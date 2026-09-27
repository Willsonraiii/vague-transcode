// lib/wasm-encode.js
// Client-side, real re-encode using ffmpeg.wasm — for the ONE case your
// byte-level remux.js can't handle: variable frame rate that needs locking
// to constant. This is the only reason to re-encode at all; everything
// else (moov, brand, timescale, DV strip) stays in remux.js because a
// re-encode always costs quality and Dolby Vision RPU almost never
// survives a WASM encode intact (see server-transcode.js for real DV
// preservation via dovi_tool).
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
    await instance.load({
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
    droppedDV: !!probe.hasDolbyVisionRPU,
  };
}
