/**
 * Generic RTXFury-style pipeline experiment.
 *
 * Runs the FULL chain from any source MP4 (not just the 600-frame reference):
 *   1. faststartRemux(isoSignature) from lib/remux.js (moov to front, video
 *      timescale -> 19200 when exactly mappable)
 *   2. video timing: x speed factor (60fps -> x2, 120fps -> x4), final-sample
 *      split, edit list, tkhd/mvhd durations, movie timescale 1000
 *   3. audio edit list scaled from the SOURCE priming (x speed)
 *   4. tools/build-rtx-second-aac.js for the audio trim + second track
 *      (filler count = 9 x audio samples by default: reference has
 *      4710 = 471 x 10 total second-track samples)
 *
 * Everything is derived from the input. Nothing is hardcoded except the
 * RTXFury signature constants (19200 video timescale, 1000 movie timescale,
 * speed = fps/30).
 *
 * Known unconfirmed rule: the audio edit-list duration. The reference has
 * video elst 19984 / audio elst 19976 (difference 8 ms). Default here:
 * audio elst = video elst - 8. Override with --audio-elst-ms N.
 *
 * Usage:
 *   node tools/rtx-pipeline.js INPUT.mp4 OUTPUT.mp4 \
 *     [--audio-elst-ms N] [--filler-count N] [--keep-temp]
 */
import { readFile, writeFile, mkdtemp, rm, stat, open, copyFile } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamFaststartRemux } from '../lib/stream-remux.js';
import { getPresetById } from '../lib/color-presets.js';

const SECOND_AAC_TOOL = new URL('./build-rtx-second-aac.js', import.meta.url);
const SPLIT_LAST_STTS_TOOL = new URL('./split-last-stts.js', import.meta.url);
const TARGET_VIDEO_TIMESCALE = 19200;
const TARGET_MOVIE_TIMESCALE = 1000;
const TARGET_FPS = 30;
const AUDIO_ELST_GAP_MS = 8; // reference: video elst 19984, audio elst 19976

// ---------------------------------------------------------------------------
// box helpers (same style as the other experiment tools)
// ---------------------------------------------------------------------------

function typeOf(b, o) {
  return b.toString('ascii', o + 4, o + 8);
}

function readBoxes(b, start, end, callback) {
  let o = start;
  while (o + 8 <= end) {
    let size = b.readUInt32BE(o);
    const type = typeOf(b, o);
    let header = 8;
    if (size === 1) {
      size = Number(b.readBigUInt64BE(o + 8));
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header || o + size > end) {
      throw new Error(`Invalid ${type} box at ${o}`);
    }
    callback({ start: o, end: o + size, content: o + header, type, header, size });
    o += size;
  }
}

function scanTrak(b, trak) {
  const result = { handler: null, tkhd: null, mdhd: null, elst: null, stbl: null, stts: null, ctts: null };
  function scan(start, end) {
    readBoxes(b, start, end, (box) => {
      if (box.type === 'hdlr') {
        const h = b.toString('ascii', box.content + 8, box.content + 12);
        if (h === 'vide' || h === 'soun') result.handler = h;
      }
      if (box.type === 'tkhd') result.tkhd = box;
      if (box.type === 'mdhd') result.mdhd = box;
      if (box.type === 'elst') result.elst = box;
      if (box.type === 'stbl') result.stbl = box;
      if (box.type === 'stts') result.stts = box;
      if (box.type === 'ctts') result.ctts = box;
      if (['trak', 'mdia', 'minf', 'stbl', 'edts'].includes(box.type)) scan(box.content, box.end);
    });
  }
  scan(trak.content, trak.end);
  return result;
}

function mdhdInfo(b, box) {
  const version = b[box.content];
  if (version === 1) {
    return {
      version,
      timescale: b.readUInt32BE(box.content + 20),
      duration: Number(b.readBigUInt64BE(box.content + 24)),
      durationOffset: box.content + 24,
      durationBytes: 8,
    };
  }
  return {
    version,
    timescale: b.readUInt32BE(box.content + 12),
    duration: b.readUInt32BE(box.content + 16),
    durationOffset: box.content + 16,
    durationBytes: 4,
  };
}

function tkhdInfo(b, box) {
  const version = b[box.content];
  if (version === 1) {
    return {
      version,
      durationOffset: box.content + 28,
      durationBytes: 8,
    };
  }
  return { version, durationOffset: box.content + 20, durationBytes: 4 };
}

function elstInfo(b, box) {
  const version = b[box.content];
  const count = b.readUInt32BE(box.content + 4);
  if (count !== 1) throw new Error(`Expected exactly one elst entry, found ${count}.`);
  if (version === 1) {
    return {
      version,
      duration: Number(b.readBigUInt64BE(box.content + 8)),
      mediaTime: Number(b.readBigInt64BE(box.content + 16)),
      durationOffset: box.content + 8,
      mediaTimeOffset: box.content + 16,
      durationBytes: 8,
    };
  }
  return {
    version,
    duration: b.readUInt32BE(box.content + 8),
    mediaTime: b.readInt32BE(box.content + 12),
    durationOffset: box.content + 8,
    mediaTimeOffset: box.content + 12,
    durationBytes: 4,
  };
}

function readStts(b, box) {
  const count = b.readUInt32BE(box.content + 4);
  const entries = [];
  let at = box.content + 8;
  for (let i = 0; i < count; i++) {
    entries.push({ count: b.readUInt32BE(at), duration: b.readUInt32BE(at + 4) });
    at += 8;
  }
  return entries;
}

function writeElst(b, info, duration, mediaTime) {
  if (info.version === 1) {
    b.writeBigUInt64BE(BigInt(duration), info.durationOffset);
    b.writeBigInt64BE(BigInt(mediaTime), info.mediaTimeOffset);
  } else {
    b.writeUInt32BE(duration, info.durationOffset);
    b.writeInt32BE(mediaTime, info.mediaTimeOffset);
  }
}

function writeDuration(b, offset, bytes, value) {
  if (bytes === 8) b.writeBigUInt64BE(BigInt(value), offset);
  else b.writeUInt32BE(value, offset);
}

function findMoov(b) {
  let moov = null;
  readBoxes(b, 0, b.length, (box) => {
    if (box.type === 'moov') moov = box;
  });
  return moov;
}

function traksOf(b, moov) {
  const out = [];
  readBoxes(b, moov.content, moov.end, (box) => {
    if (box.type === 'trak') out.push({ box, info: scanTrak(b, box) });
  });
  return out;
}

function stszCount(b, stblBox) {
  let count = null;
  readBoxes(b, stblBox.content, stblBox.end, (box) => {
    if (box.type === 'stsz') count = b.readUInt32BE(box.content + 8);
  });
  return count;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const positional = [];
let audioElstMsOverride = null;
let fillerCountOverride = null;
let keepTemp = false;
let keepDv = false;
let colorPreset = 'original';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--audio-elst-ms') audioElstMsOverride = Number(args[++i]);
  else if (arg === '--filler-count') fillerCountOverride = Number(args[++i]);
  else if (arg === '--keep-temp') keepTemp = true;
  else if (arg === '--keep-dv') keepDv = true; // mode "standard": leave Dolby Vision signalling untouched
  else if (arg === '--grade') colorPreset = String(args[++i] || 'original');
  else positional.push(arg);
}

const inputPath = positional[0];
const outputPath = positional[1];

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/rtx-pipeline.js INPUT.mp4 OUTPUT.mp4 [--audio-elst-ms N] [--filler-count N] [--keep-temp]');
  process.exit(1);
}

const warnings = [];

function reportProgress(percent, stage) {
  // Parsed by server-rtx-online.js; does not affect processing.
  process.stderr.write(`progress ${percent} ${stage}\n`);
}

async function applyColorGrade(srcPath, dstPath, presetId) {
  const presetObj = getPresetById(presetId);
  if (!presetObj || !presetObj.ffmpegFilter) {
    await copyFile(srcPath, dstPath);
    return;
  }

  // Get duration and fps for progress tracking and timing integrity
  let durationSec = 0;
  let sourceFps = 60;
  try {
    const probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=r_frame_rate:format=duration',
      '-of', 'json',
      srcPath,
    ], { encoding: 'utf8', timeout: 5000 });
    if (probe.status === 0 && probe.stdout) {
      const data = JSON.parse(probe.stdout);
      durationSec = parseFloat(data.format?.duration || '0') || 0;
      const fr = data.streams?.[0]?.r_frame_rate;
      if (fr && fr.includes('/')) {
        const [n, d] = fr.split('/').map(Number);
        if (n && d) sourceFps = Math.round(n / d);
      }
    }
  } catch {}

  const targetFps = sourceFps >= 50 ? 60 : 30;
  // Memory-safe scaling: clamps 4K/UHD down to 1080p (fast_bilinear), keeping aspect ratio and native res if <=1080p
  const scaleFilter = "scale='if(gte(iw,ih),min(1920,iw),min(1080,iw))':-2:flags=fast_bilinear";
  const fullVf = [scaleFilter, presetObj.ffmpegFilter].filter(Boolean).join(',');

  const ffArgs = [
    '-y',
    '-i', srcPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', fullVf,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '19',
    '-r', String(targetFps),
    '-video_track_timescale', '600',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-threads', '1',
    '-x264-params', 'no-mbtree=1:rc-lookahead=0:sync-lookahead=0:b-adapt=0:bframes=0:ref=1:aq-mode=0',
    '-progress', 'pipe:2',
    dstPath,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ffArgs, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let lastProgressPct = 5;
    let errOutput = '';

    child.stderr.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/out_time_us=(\d+)/);
      if (match && durationSec > 0) {
        const currentSec = parseInt(match[1], 10) / 1000000;
        const pct = Math.min(45, Math.max(5, Math.round(5 + (currentSec / durationSec) * 40)));
        if (pct > lastProgressPct) {
          lastProgressPct = pct;
          reportProgress(pct, 'color-grading');
        }
      }
      errOutput += text;
      if (errOutput.length > 2000) errOutput = errOutput.slice(-2000);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg color grade: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        const reason = signal ? `killed with signal ${signal}` : `exited with code ${code}`;
        reject(new Error(`ffmpeg color grade ${reason}: ${errOutput.slice(-500).trim()}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 1. streamFaststartRemux with the iso signature directly to disk
// ---------------------------------------------------------------------------

const inputStat = await stat(inputPath);
const inputBytes = inputStat.size;

const workDir = await mkdtemp(path.join(tmpdir(), 'vague-rtx-pipeline-'));
const isGraded = Boolean(colorPreset && colorPreset !== 'original');
let stage0Path = inputPath;

if (isGraded) {
  reportProgress(5, 'color-grading');
  stage0Path = path.join(workDir, 'stage0-graded.mp4');
  await applyColorGrade(inputPath, stage0Path, colorPreset);
}

const stage1Path = path.join(workDir, 'stage1.mp4');
const stage2Path = path.join(workDir, 'stage2.mp4');

reportProgress(isGraded ? 50 : 10, 'reading');
const remuxed = await streamFaststartRemux(stage0Path, stage1Path, {
  stripDV: !keepDv,
  rebrand: true,
  isoSignature: true,
});

const dvStripped = remuxed.dvStripped;
const rebranded = remuxed.rebranded;
reportProgress(isGraded ? 65 : 35, 'remuxed');

// ---------------------------------------------------------------------------
// 2. Read only the header of stage1.mp4 to derive and apply timing transforms
// ---------------------------------------------------------------------------

const fh1 = await open(stage1Path, 'r+');
const stage1Stat = await fh1.stat();

let o = 0;
const hBuf = Buffer.alloc(16);
let moov = null;
while (o < stage1Stat.size) {
  const { bytesRead } = await fh1.read(hBuf, 0, 8, o);
  if (bytesRead < 8) break;
  let size = hBuf.readUInt32BE(0);
  const type = hBuf.toString('ascii', 4, 8);
  let header = 8;
  if (size === 1) {
    await fh1.read(hBuf, 8, 8, o + 8);
    size = Number(hBuf.readBigUInt64BE(8));
    header = 16;
  } else if (size === 0) {
    size = stage1Stat.size - o;
  }
  if (type === 'moov') {
    moov = { type, start: o, end: o + size, size, header, content: o + header };
    break;
  }
  o += size;
}

if (!moov) {
  await fh1.close();
  throw new Error('No moov box after remux (unexpected).');
}

const b = Buffer.alloc(moov.end);
await fh1.read(b, 0, moov.end, 0);

let mvhdBox = null;
readBoxes(b, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') mvhdBox = box;
});
if (!mvhdBox) {
  await fh1.close();
  throw new Error('No mvhd box found.');
}

const mvhdVersion = b[mvhdBox.content];
const mvhdTimescaleOffset = mvhdBox.content + (mvhdVersion === 1 ? 20 : 12);
const mvhdDurationMeta = mvhdVersion === 1
  ? { offset: mvhdBox.content + 24, bytes: 8 }
  : { offset: mvhdBox.content + 16, bytes: 4 };

const traks = traksOf(b, moov);
const video = traks.find((t) => t.info.handler === 'vide');
const audios = traks.filter((t) => t.info.handler === 'soun');
if (!video) {
  await fh1.close();
  throw new Error('No video track after remux.');
}
if (audios.length !== 1) {
  await fh1.close();
  throw new Error(`Expected exactly one audio track, found ${audios.length}.`);
}
const audio = audios[0];

const vInfo = video.info;
const aInfo = audio.info;
if (!vInfo.mdhd || !vInfo.stts || !vInfo.elst || !vInfo.tkhd) {
  await fh1.close();
  throw new Error('Video track is missing mdhd/stts/elst/tkhd.');
}
if (!aInfo.mdhd || !aInfo.stts || !aInfo.elst || !aInfo.tkhd || !aInfo.stbl) {
  await fh1.close();
  throw new Error('Audio track is missing mdhd/stts/elst/tkhd/stbl.');
}

const videoMdhd = mdhdInfo(b, vInfo.mdhd);
const activeVideoTimescale = videoMdhd.timescale;
if (activeVideoTimescale !== TARGET_VIDEO_TIMESCALE) {
  warnings.push(`Video timescale is ${activeVideoTimescale} (iso signature scaling to ${TARGET_VIDEO_TIMESCALE} was skipped).`);
}

const videoStts = readStts(b, vInfo.stts);
const uniformDuration = videoStts[0].duration;
if (!videoStts.every((e) => e.duration === uniformDuration)) {
  warnings.push('Video stts is not uniform (variable frame duration). Proceeding anyway.');
}

const sourceFps = activeVideoTimescale / uniformDuration;
const speed = sourceFps / TARGET_FPS;
if (speed <= 0) {
  await fh1.close();
  throw new Error(`Invalid speed factor ${speed}.`);
}

const videoFrameCount = videoStts.reduce((a, e) => a + e.count, 0);
const lastEntry = videoStts[videoStts.length - 1];
// Allow both even and odd sample durations; split-last-stts uses Math.floor


// Video edit list media time: the first composition offset (scaled), which
// zero-bases the presentation like the reference (video elst media_time 1280
// = first ctts offset x speed on the matching source).
const videoElst = elstInfo(b, vInfo.elst);
let firstCttsOffset = 0;
if (vInfo.ctts) {
  const entries = b.readUInt32BE(vInfo.ctts.content + 4);
  if (entries > 0) {
    firstCttsOffset = b.readInt32BE(vInfo.ctts.content + 12);
  }
}
const videoMediaTime = Math.max(0, Math.round(firstCttsOffset * speed));

// Scaled media duration and the final-sample split.
const scaledMediaTicks = videoFrameCount * uniformDuration * speed;
const halfLast = Math.floor((lastEntry.duration * speed) / 2);
const videoMediaTicks = Math.round(scaledMediaTicks - halfLast); // e.g. 600*640 - 320 = 383680
const videoElstMs = Math.ceil((videoMediaTicks / activeVideoTimescale) * TARGET_MOVIE_TIMESCALE);

// Audio edit list.
const audioElst = elstInfo(b, aInfo.elst);
const audioMdhd = mdhdInfo(b, aInfo.mdhd);
const audioPrimedMediaTime = Math.round(audioElst.mediaTime * speed);
if (audioPrimedMediaTime < 0) {
  await fh1.close();
  throw new Error('Audio elst media_time is negative after scaling.');
}

let audioElstMs;
if (audioElstMsOverride !== null) {
  audioElstMs = audioElstMsOverride;
} else {
  audioElstMs = videoElstMs - AUDIO_ELST_GAP_MS;
  warnings.push(
    `Audio edit duration uses the UNCONFIRMED rule video_elst - ${AUDIO_ELST_GAP_MS}ms ` +
    `(${videoElstMs} - ${AUDIO_ELST_GAP_MS} = ${audioElstMs}). The reference file matches this, ` +
    `but the rule has only been verified on one file. Override with --audio-elst-ms.`,
  );
}

const audioEditTicks = Math.round((audioElstMs * audioMdhd.timescale) / TARGET_MOVIE_TIMESCALE);

const audioSamples = stszCount(b, aInfo.stbl);
if (!audioSamples || audioSamples < 2) {
  await fh1.close();
  throw new Error('Audio track has fewer than two samples.');
}
const fillerCount = fillerCountOverride !== null ? fillerCountOverride : 9 * audioSamples;
if (fillerCountOverride === null) {
  warnings.push(
    `Filler count uses the 10x rule: 9 x ${audioSamples} = ${fillerCount} ` +
    `(reference: 471 samples -> 4710 total = 471x10). Override with --filler-count.`,
  );
}

// ---------------------------------------------------------------------------
// 3. Apply the timing transforms in place
// ---------------------------------------------------------------------------

// Video stts: scale every duration by speed
{
  let at = vInfo.stts.content + 8;
  for (let i = 0; i < videoStts.length; i++) {
    b.writeUInt32BE(Math.round(videoStts[i].duration * speed), at + 4);
    at += 8;
  }
}

// Video ctts: scale offsets by speed (composition offsets are signed 32-bit integers)
if (vInfo.ctts) {
  const entries = b.readUInt32BE(vInfo.ctts.content + 4);
  let at = vInfo.ctts.content + 8;
  for (let i = 0; i < entries; i++) {
    const value = b.readInt32BE(at + 4);
    const scaled = Math.round(value * speed);
    b.writeInt32BE(scaled, at + 4);
    at += 8;
  }
}

// Video mdhd duration = media ticks after the split.
writeDuration(b, videoMdhd.durationOffset, videoMdhd.durationBytes, videoMediaTicks);

// Video elst + tkhd.
writeElst(b, videoElst, videoElstMs, videoMediaTime);
const videoTkhd = tkhdInfo(b, vInfo.tkhd);
writeDuration(b, videoTkhd.durationOffset, videoTkhd.durationBytes, videoElstMs);

// Audio elst
writeElst(b, audioElst, audioElstMs, audioPrimedMediaTime);

// Movie header: timescale 1000, duration = video edit duration.
b.writeUInt32BE(TARGET_MOVIE_TIMESCALE, mvhdTimescaleOffset);
writeDuration(b, mvhdDurationMeta.offset, mvhdDurationMeta.bytes, videoElstMs);

// Write modified header back into stage1Path
await fh1.write(b, 0, b.length, 0);
await fh1.close();

// ---------------------------------------------------------------------------
// 4. Hand off to the validated second-AAC tool
// ---------------------------------------------------------------------------

reportProgress(isGraded ? 75 : 55, 'timing');

// Final-sample split (validated tool; rebuilds moov and shifts offsets).
if (global.gc) global.gc();
const splitRun = spawnSync(
  process.execPath,
  ['--max-old-space-size=96', fileURLToPath(SPLIT_LAST_STTS_TOOL), stage1Path, stage2Path],
  { encoding: 'utf8' },
);
process.stdout.write(splitRun.stdout || '');
if (splitRun.status !== 0) {
  process.stderr.write(splitRun.stderr || '');
  const detail = (splitRun.stderr || splitRun.stdout || '').trim();
  throw new Error(`tools/split-last-stts.js failed (${splitRun.status}): ${detail}`);
}

// Audio trim + second AAC track (validated tool).
reportProgress(isGraded ? 85 : 70, 'split-done');

if (global.gc) global.gc();
const toolArgs = [
  '--max-old-space-size=96',
  fileURLToPath(SECOND_AAC_TOOL), stage2Path, outputPath,
  '--filler-count', String(fillerCount),
  '--mvhd-v1-unknown',
  '--drop-udta',
];
const run = spawnSync(process.execPath, toolArgs, { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
if (run.status !== 0) {
  process.stderr.write(run.stderr || '');
  const detail = (run.stderr || run.stdout || '').trim();
  throw new Error(`tools/build-rtx-second-aac.js failed (${run.status}): ${detail}`);
}

if (!keepTemp) {
  await rm(workDir, { recursive: true, force: true });
}

reportProgress(95, 'audio-done');

// ---------------------------------------------------------------------------
// 6. Report
// ---------------------------------------------------------------------------

const outputStat = await stat(outputPath);
const outputBytes = outputStat.size;
const summary = {
  mode: keepDv ? 'standard' : 'hdr',
  colorPreset,
  inputBytes,
  outputBytes,
  sizeGrowth: outputBytes - inputBytes,
  hadDolbyVision: keepDv
    ? null
    : Boolean(dvStripped && (dvStripped.boxes > 0 || dvStripped.retagged > 0)),
  dvStripped,
  rebranded,
  derived: {
    sourceVideoTimescale: remuxed.isoSigned?.factor
      ? activeVideoTimescale / remuxed.isoSigned.factor
      : activeVideoTimescale,
    sourceFps,
    speed,
    videoFrameCount,
    videoSttsAfter: `${videoFrameCount - 1}x${uniformDuration * speed}, 1x${halfLast}`,
    videoMediaTicks,
    firstCttsOffset,
    videoElst: { durationMs: videoElstMs, mediaTime: videoMediaTime },
    audioPriming: audioPrimedMediaTime,
    audioElst: { durationMs: audioElstMs, mediaTime: audioPrimedMediaTime },
    audioEditTicks,
    audioSamples,
    fillerCount,
    secondTrackSamples: audioSamples + fillerCount,
  },
  warnings,
};
console.log(JSON.stringify(summary, null, 2));
// Machine-readable single line for server-rtx-online.js
console.log('PIPELINE_RESULT ' + JSON.stringify(summary));
