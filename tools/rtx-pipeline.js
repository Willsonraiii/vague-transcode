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
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { faststartRemux } from '../lib/remux.js';

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
      if (box.type === 'hdlr') result.handler = b.toString('ascii', box.content + 8, box.content + 12);
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

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--audio-elst-ms') audioElstMsOverride = Number(args[++i]);
  else if (arg === '--filler-count') fillerCountOverride = Number(args[++i]);
  else if (arg === '--keep-temp') keepTemp = true;
  else positional.push(arg);
}

const inputPath = positional[0];
const outputPath = positional[1];

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/rtx-pipeline.js INPUT.mp4 OUTPUT.mp4 [--audio-elst-ms N] [--filler-count N] [--keep-temp]');
  process.exit(1);
}

const warnings = [];

// ---------------------------------------------------------------------------
// 1. Pre-check the source: video timescale must map to 19200 exactly
// ---------------------------------------------------------------------------

const source = await readFile(inputPath);
let sourceMoov = findMoov(source);
if (!sourceMoov) throw new Error('No moov box found in source.');
const sourceTraks = traksOf(source, sourceMoov);
const sourceVideo = sourceTraks.find((t) => t.info.handler === 'vide');
if (!sourceVideo) throw new Error('No video track found in source.');

const sourceVideoMdhd = mdhdInfo(source, sourceVideo.info.mdhd);
if (!Number.isInteger(TARGET_VIDEO_TIMESCALE / sourceVideoMdhd.timescale)) {
  throw new Error(
    `Source video timescale ${sourceVideoMdhd.timescale} cannot be mapped losslessly to 19200 ` +
    `(19200/${sourceVideoMdhd.timescale} is not an integer). This source needs a full remux path ` +
    `that is not implemented yet.`,
  );
}

// ---------------------------------------------------------------------------
// 2. faststartRemux with the iso signature
// ---------------------------------------------------------------------------

const inputBlob = new Blob([source], { type: 'video/mp4' });
// stripDV: the RTXFury output does NOT carry the Dolby Vision config record —
// it presents as plain HLG HDR, and that is what makes TikTok deliver an HDR
// (HLG) result. Our first TikTok test kept the DV record and TikTok did NOT
// deliver HDR. rebrand: the reference major brand is isom.
const remuxed = await faststartRemux(inputBlob, () => {}, {
  stripEdits: false,
  stripDV: true,
  zeroDuration: false,
  rebrand: true,
  isoSignature: true,
});
const b = Buffer.from(await remuxed.blob.arrayBuffer());

// ---------------------------------------------------------------------------
// 3. Parse and derive everything
// ---------------------------------------------------------------------------

const moov = findMoov(b);
if (!moov) throw new Error('No moov box after remux (unexpected).');

let mvhdBox = null;
readBoxes(b, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') mvhdBox = box;
});
if (!mvhdBox) throw new Error('No mvhd box found.');

const mvhdVersion = b[mvhdBox.content];
const mvhdTimescaleOffset = mvhdBox.content + (mvhdVersion === 1 ? 20 : 12);
const mvhdDurationMeta = mvhdVersion === 1
  ? { offset: mvhdBox.content + 24, bytes: 8 }
  : { offset: mvhdBox.content + 16, bytes: 4 };

const traks = traksOf(b, moov);
const video = traks.find((t) => t.info.handler === 'vide');
const audios = traks.filter((t) => t.info.handler === 'soun');
if (!video) throw new Error('No video track after remux.');
if (audios.length !== 1) throw new Error(`Expected exactly one audio track, found ${audios.length}.`);
const audio = audios[0];

const vInfo = video.info;
const aInfo = audio.info;
if (!vInfo.mdhd || !vInfo.stts || !vInfo.elst || !vInfo.tkhd) {
  throw new Error('Video track is missing mdhd/stts/elst/tkhd.');
}
if (!aInfo.mdhd || !aInfo.stts || !aInfo.elst || !aInfo.tkhd || !aInfo.stbl) {
  throw new Error('Audio track is missing mdhd/stts/elst/tkhd/stbl.');
}

const videoMdhd = mdhdInfo(b, vInfo.mdhd);
if (videoMdhd.timescale !== TARGET_VIDEO_TIMESCALE) {
  throw new Error(
    `Video timescale is ${videoMdhd.timescale} after remux, expected 19200. ` +
    `The iso signature scaling was skipped for this source.`,
  );
}

const videoStts = readStts(b, vInfo.stts);
const uniformDuration = videoStts[0].duration;
if (!videoStts.every((e) => e.duration === uniformDuration)) {
  throw new Error('Video stts is not uniform (variable frame duration). Not supported yet.');
}
if (uniformDuration % TARGET_FPS !== 0 && (TARGET_VIDEO_TIMESCALE / uniformDuration) % 1 !== 0) {
  throw new Error(`Cannot derive integer fps from stts duration ${uniformDuration}.`);
}
const sourceFps = TARGET_VIDEO_TIMESCALE / uniformDuration;
const speed = sourceFps / TARGET_FPS;
if (!Number.isInteger(speed) || speed < 1) {
  throw new Error(`Source fps ${sourceFps} does not map to an integer speed factor (fps/30).`);
}

const videoFrameCount = videoStts.reduce((a, e) => a + e.count, 0);
const lastEntry = videoStts[videoStts.length - 1];
if (lastEntry.duration % 2 !== 0) {
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
if (videoMediaTime < 0) throw new Error('Video elst media_time is negative after scaling.');

// Scaled media duration and the final-sample split.
const scaledMediaTicks = videoFrameCount * uniformDuration * speed;
const halfLast = (lastEntry.duration * speed) / 2;
const videoMediaTicks = scaledMediaTicks - halfLast; // e.g. 600*640 - 320 = 383680
const videoElstMs = Math.ceil((videoMediaTicks / TARGET_VIDEO_TIMESCALE) * TARGET_MOVIE_TIMESCALE);

// Audio edit list.
const audioElst = elstInfo(b, aInfo.elst);
const audioMdhd = mdhdInfo(b, aInfo.mdhd);
const audioPrimedMediaTime = audioElst.mediaTime * speed;
if (audioPrimedMediaTime < 0) throw new Error('Audio elst media_time is negative after scaling.');

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
if (!audioSamples || audioSamples < 2) throw new Error('Audio track has fewer than two samples.');
const fillerCount = fillerCountOverride !== null ? fillerCountOverride : 9 * audioSamples;
if (fillerCountOverride === null) {
  warnings.push(
    `Filler count uses the 10x rule: 9 x ${audioSamples} = ${fillerCount} ` +
    `(reference: 471 samples -> 4710 total = 471x10). Override with --filler-count.`,
  );
}

// ---------------------------------------------------------------------------
// 4. Apply the timing transforms in place
// ---------------------------------------------------------------------------

// Video stts: scale every duration by speed (entry count unchanged; the
// final-sample split is done by tools/split-last-stts.js in a later step,
// because splitting grows the stts box and requires a moov rebuild).
{
  let at = vInfo.stts.content + 8;
  for (let i = 0; i < videoStts.length; i++) {
    b.writeUInt32BE(videoStts[i].duration * speed, at + 4);
    at += 8;
  }
}

// Video ctts: scale offsets by speed (same as lib/rtx-duration.js).
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

// Audio elst (the second-AAC tool trusts these values).
writeElst(b, audioElst, audioElstMs, audioPrimedMediaTime);

// Movie header: timescale 1000, duration = video edit duration.
b.writeUInt32BE(TARGET_MOVIE_TIMESCALE, mvhdTimescaleOffset);
writeDuration(b, mvhdDurationMeta.offset, mvhdDurationMeta.bytes, videoElstMs);

// ---------------------------------------------------------------------------
// 5. Hand off to the validated second-AAC tool
// ---------------------------------------------------------------------------

const workDir = await mkdtemp(path.join(tmpdir(), 'vague-rtx-pipeline-'));
const stage1Path = path.join(workDir, 'stage1.mp4');
const stage2Path = path.join(workDir, 'stage2.mp4');
await writeFile(stage1Path, b);

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
const toolArgs = [
  fileURLToPath(SECOND_AAC_TOOL), stage2Path, outputPath,
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

if (!keepTemp) {
  await rm(workDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 6. Report
// ---------------------------------------------------------------------------

const output = await readFile(outputPath);
console.log(JSON.stringify({
  inputBytes: source.length,
  outputBytes: output.length,
  sizeGrowth: output.length - source.length,
  dvStripped: remuxed.dvStripped,
  rebranded: remuxed.rebranded,
  derived: {
    sourceVideoTimescale: sourceVideoMdhd.timescale,
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
}, null, 2));
