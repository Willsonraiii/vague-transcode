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
import { spawnSync } from 'node:child_process';
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

// ---------------------------------------------------------------------------
// 1. streamFaststartRemux with the iso signature directly to disk
// ---------------------------------------------------------------------------

const inputStat = await stat(inputPath);
const inputBytes = inputStat.size;

reportProgress(5, 'reading');
const workDir = await mkdtemp(path.join(tmpdir(), 'vague-rtx-pipeline-'));
const stage1Path = path.join(workDir, 'stage1.mp4');
const stage2Path = path.join(workDir, 'stage2.mp4');

const remuxed = await streamFaststartRemux(inputPath, stage1Path, {
  stripDV: !keepDv,
  rebrand: true,
  isoSignature: true,
});

const dvStripped = remuxed.dvStripped;
const rebranded = remuxed.rebranded;
reportProgress(35, 'remuxed');

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
if (videoMdhd.timescale !== TARGET_VIDEO_TIMESCALE) {
  await fh1.close();
  throw new Error(
    `Video timescale is ${videoMdhd.timescale} after remux, expected 19200. ` +
    `The iso signature scaling was skipped for this source.`,
  );
}

const videoStts = readStts(b, vInfo.stts);
const uniformDuration = videoStts[0].duration;
if (!videoStts.every((e) => e.duration === uniformDuration)) {
  await fh1.close();
  throw new Error('Video stts is not uniform (variable frame duration). Not supported yet.');
}
if (uniformDuration % TARGET_FPS !== 0 && (TARGET_VIDEO_TIMESCALE / uniformDuration) % 1 !== 0) {
  await fh1.close();
  throw new Error(`Cannot derive integer fps from stts duration ${uniformDuration}.`);
}
const sourceFps = TARGET_VIDEO_TIMESCALE / uniformDuration;
const speed = sourceFps / TARGET_FPS;
if (!Number.isInteger(speed) || speed < 1) {
  await fh1.close();
  throw new Error(`Source fps ${sourceFps} does not map to an integer speed factor (fps/30).`);
}

const videoFrameCount = videoStts.reduce((a, e) => a + e.count, 0);
const lastEntry = videoStts[videoStts.length - 1];
if (lastEntry.duration % 2 !== 0) {
  await fh1.close();
  throw new Error(`Last video sample duration ${lastEntry.duration} is odd; cannot split in half.`);
}

// Video edit list media time: the first composition offset (scaled), which
// zero-bases the presentation like the reference (video elst media_time 1280
// = first ctts offset x speed on the matching source).
const videoElst = elstInfo(b, vInfo.elst);
let firstCttsOffset = 0;
if (vInfo.ctts) {
  const entries = b.readUInt32BE(vInfo.ctts.content + 4);
  if (entries > 0) {
    const version = b[vInfo.ctts.content];
    firstCttsOffset = version === 1
      ? b.readInt32BE(vInfo.ctts.content + 12)
      : b.readUInt32BE(vInfo.ctts.content + 12);
  }
}
const videoMediaTime = firstCttsOffset * speed;
if (videoMediaTime < 0) {
  await fh1.close();
  throw new Error('Video elst media_time is negative after scaling.');
}

// Scaled media duration and the final-sample split.
const scaledMediaTicks = videoFrameCount * uniformDuration * speed;
const halfLast = (lastEntry.duration * speed) / 2;
const videoMediaTicks = scaledMediaTicks - halfLast; // e.g. 600*640 - 320 = 383680
const videoElstMs = Math.ceil((videoMediaTicks / TARGET_VIDEO_TIMESCALE) * TARGET_MOVIE_TIMESCALE);

// Audio edit list.
const audioElst = elstInfo(b, aInfo.elst);
const audioMdhd = mdhdInfo(b, aInfo.mdhd);
const audioPrimedMediaTime = audioElst.mediaTime * speed;
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
    b.writeUInt32BE(videoStts[i].duration * speed, at + 4);
    at += 8;
  }
}

// Video ctts: scale offsets by speed
if (vInfo.ctts) {
  const entries = b.readUInt32BE(vInfo.ctts.content + 4);
  const version = b[vInfo.ctts.content];
  let at = vInfo.ctts.content + 8;
  for (let i = 0; i < entries; i++) {
    const value = version === 1 ? b.readInt32BE(at + 4) : b.readUInt32BE(at + 4);
    const scaled = value * speed;
    if (version === 1) b.writeInt32BE(scaled, at + 4);
    else b.writeUInt32BE(scaled, at + 4);
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

reportProgress(55, 'timing');

// Final-sample split (validated tool; rebuilds moov and shifts offsets).
const splitRun = spawnSync(
  process.execPath,
  [fileURLToPath(SPLIT_LAST_STTS_TOOL), stage1Path, stage2Path],
  { encoding: 'utf8' },
);
process.stdout.write(splitRun.stdout || '');
if (splitRun.status !== 0) {
  process.stderr.write(splitRun.stderr || '');
  throw new Error(`tools/split-last-stts.js failed with status ${splitRun.status}.`);
}

// Audio trim + second AAC track (validated tool).
reportProgress(70, 'split-done');
const isGraded = Boolean(colorPreset && colorPreset !== 'original');
const stage3Path = isGraded ? path.join(workDir, 'stage3.mp4') : outputPath;

const toolArgs = [
  fileURLToPath(SECOND_AAC_TOOL), stage2Path, stage3Path,
  '--filler-count', String(fillerCount),
  '--mvhd-v1-unknown',
  '--drop-udta',
];
const run = spawnSync(process.execPath, toolArgs, { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
if (run.status !== 0) {
  process.stderr.write(run.stderr || '');
  throw new Error(`tools/build-rtx-second-aac.js failed with status ${run.status}.`);
}

if (isGraded) {
  reportProgress(75, 'color-grading');
  const presetObj = getPresetById(colorPreset);
  if (presetObj && presetObj.ffmpegFilter) {
    const ffArgs = [
      '-y',
      '-i', stage3Path,
      '-vf', presetObj.ffmpegFilter,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-threads', '2',
      '-movflags', '+faststart',
      outputPath,
    ];
    const ff = spawnSync('ffmpeg', ffArgs, { encoding: 'utf8' });
    if (ff.status !== 0) {
      process.stderr.write(ff.stderr || '');
      throw new Error(`ffmpeg color grade failed with status ${ff.status}.`);
    }
  } else {
    await copyFile(stage3Path, outputPath);
  }
}

if (!keepTemp) {
  await rm(workDir, { recursive: true, force: true });
}

reportProgress(95, isGraded ? 'grading-done' : 'audio-done');

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
      ? TARGET_VIDEO_TIMESCALE / remuxed.isoSigned.factor
      : TARGET_VIDEO_TIMESCALE,
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
