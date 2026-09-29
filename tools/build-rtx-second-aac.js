/**
 * RTXFury second-AAC-track experiment.
 *
 * Input:  an MP4 that has already been through the documented video-side
 *         experiment chain (faststartRemux(isoSignature) ->
 *         applyRtxDurationExperiment -> patchVideoEditList ->
 *         tools/split-last-stts.js -> tools/patch-rtx-movie-time.js) and has
 *         exactly one audio ('soun') track still at source timing.
 *
 * Output: the same file with
 *   1. the existing AAC track's timing scaled by the speed factor (default 2,
 *      matching the "[src 60fps x2]" slowdown), i.e. every stts delta and the
 *      mdhd duration are doubled while the 48000 Hz timescale is kept, and
 *      the audio edit list / tkhd duration are recomputed from the scaled
 *      media duration;
 *   2. a NEW second audio track that reproduces the observed RTXFury layout:
 *        - the same 471-ish AAC sample payloads as track 1 (copied bytes),
 *        - followed by N filler samples of an exact 8-byte payload
 *          (default 4239 x 0000000400000000, 1 tick each),
 *        - stts = scaled track-1 entries + one filler entry,
 *        - its own stsc/stsz/stco tables pointing at the appended data,
 *        - the same edit list values as track 1.
 *
 * Start modes for the second track (how it begins playback at DTS 0 without
 * skip-samples side data, as observed in the RTXFury reference):
 *   ctts  (default) keep elst media_time and add a ctts composition offset
 *                   equal to media_time so FFmpeg's mov demuxer keeps every
 *                   packet inside the edit window (see mov_fix_index in
 *                   libavformat/mov.c: a positive elst media_time otherwise
 *                   rewrites leading samples to negative DTS + skip_samples).
 *   zero            set the second track's elst media_time to 0 instead.
 *   clone           exact behavioural clone of track 1 (no ctts) — produces
 *                   the negative-DTS + skip-samples behaviour for A/B tests.
 *
 * The media time of the first track is TRUSTED from the input elst (it is the
 * already-patched RTXFury target value, 4224 for the reference source). The
 * generic version of this tool must instead derive it from the source priming.
 *
 * Usage:
 *   node tools/build-rtx-second-aac.js INPUT.mp4 OUTPUT.mp4 \
 *     [--start-mode ctts|zero|clone] [--filler-count 4239] \
 *     [--filler-duration 1] [--filler-hex 0000000400000000] \
 *     [--speed-factor 2]
 */
import { readFile, writeFile } from 'node:fs/promises';

function typeOf(b, o) {
  return b.toString('ascii', o + 4, o + 8);
}

function readBoxes(b, start, end, callback) {
  let o = start;

  while (o + 8 <= end) {
    const originalSize = b.readUInt32BE(o);
    const type = typeOf(b, o);
    let size = originalSize;
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

function makeBox(type, content) {
  const out = Buffer.alloc(8 + content.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, 4, 'ascii');
  content.copy(out, 8);
  return out;
}

function concat(parts) {
  return Buffer.concat(parts);
}

function u32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Value does not fit uint32 (${label}): ${value}`);
  }
  return value;
}

/**
 * Deep-scan one trak for the boxes this tool needs. All offsets are absolute
 * positions inside the full input buffer.
 */
function scanTrak(b, trak) {
  const result = {
    handler: null,
    tkhd: null,
    mdhd: null,
    elst: null,
    stbl: null,
  };

  function scan(start, end) {
    readBoxes(b, start, end, (box) => {
      if (box.type === 'hdlr') {
        result.handler = b.toString('ascii', box.content + 8, box.content + 12);
      }

      if (box.type === 'tkhd') result.tkhd = box;
      if (box.type === 'mdhd') result.mdhd = box;
      if (box.type === 'elst') result.elst = box;
      if (box.type === 'stbl') result.stbl = box;

      if (['trak', 'mdia', 'minf', 'stbl', 'edts'].includes(box.type)) {
        scan(box.content, box.end);
      }
    });
  }

  scan(trak.content, trak.end);
  return result;
}

function scanStbl(b, stbl) {
  const result = { stsd: null, stts: null, ctts: null, stsc: null, stsz: null, stco: null, co64: null, dropped: [] };

  readBoxes(b, stbl.content, stbl.end, (box) => {
    if (box.type === 'stsd') result.stsd = box;
    if (box.type === 'stts') result.stts = box;
    if (box.type === 'ctts') result.ctts = box;
    if (box.type === 'stsc') result.stsc = box;
    if (box.type === 'stsz') result.stsz = box;
    if (box.type === 'stco') result.stco = box;
    if (box.type === 'co64') result.co64 = box;
    if (box.type === 'sgpd' || box.type === 'sbgp') result.dropped.push(box.type);
  });

  return result;
}

function mdhdInfo(b, box) {
  const version = b[box.content];

  if (version === 1) {
    return {
      version,
      timescale: b.readUInt32BE(box.content + 20),
      duration: Number(b.readBigUInt64BE(box.content + 28)),
      durationOffset: box.content + 28,
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
      trackId: b.readUInt32BE(box.content + 20),
      trackIdOffset: box.content + 20,
      duration: Number(b.readBigUInt64BE(box.content + 28)),
      durationOffset: box.content + 28,
      durationBytes: 8,
    };
  }

  return {
    version,
    trackId: b.readUInt32BE(box.content + 12),
    trackIdOffset: box.content + 12,
    duration: b.readUInt32BE(box.content + 20),
    durationOffset: box.content + 20,
    durationBytes: 4,
  };
}

function elstInfo(b, box) {
  const version = b[box.content];
  const count = b.readUInt32BE(box.content + 4);

  if (count !== 1) {
    throw new Error(`Expected exactly one elst entry, found ${count}.`);
  }

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

function readStsz(b, box) {
  const sampleSize = b.readUInt32BE(box.content + 4);
  const count = b.readUInt32BE(box.content + 8);

  if (sampleSize !== 0) {
    return { uniform: true, sampleSize, count, sizes: null };
  }

  const sizes = [];
  let at = box.content + 12;

  for (let i = 0; i < count; i++) {
    sizes.push(b.readUInt32BE(at));
    at += 4;
  }

  return { uniform: false, sampleSize: 0, count, sizes };
}

function readStsc(b, box) {
  const count = b.readUInt32BE(box.content + 4);
  const entries = [];
  let at = box.content + 8;

  for (let i = 0; i < count; i++) {
    entries.push({
      firstChunk: b.readUInt32BE(at),
      samplesPerChunk: b.readUInt32BE(at + 4),
      sampleDescriptionIndex: b.readUInt32BE(at + 8),
    });
    at += 12;
  }

  return entries;
}

function readChunkOffsets(b, info) {
  const box = info.stco || info.co64;
  if (!box) throw new Error('Audio track has no stco/co64 table.');

  const count = b.readUInt32BE(box.content + 4);
  const offsets = [];
  let at = box.content + 8;

  for (let i = 0; i < count; i++) {
    if (info.stco) {
      offsets.push(b.readUInt32BE(at));
      at += 4;
    } else {
      offsets.push(Number(b.readBigUInt64BE(at)));
      at += 8;
    }
  }

  return offsets;
}

/** Absolute file offset of every sample, from stsc + stco + stsz. */
function sampleOffsets(stscEntries, chunkOffsets, sizes, sampleCount) {
  const offsets = new Array(sampleCount);
  let sample = 0;

  for (let chunk = 0; chunk < chunkOffsets.length && sample < sampleCount; chunk++) {
    const chunkNumber = chunk + 1;
    let samplesPerChunk = stscEntries.length
      ? stscEntries[stscEntries.length - 1].samplesPerChunk
      : 1;

    for (let e = 0; e < stscEntries.length; e++) {
      const next = e + 1 < stscEntries.length
        ? stscEntries[e + 1].firstChunk
        : Infinity;

      if (chunkNumber >= stscEntries[e].firstChunk && chunkNumber < next) {
        samplesPerChunk = stscEntries[e].samplesPerChunk;
        break;
      }
    }

    let at = chunkOffsets[chunk];

    for (let k = 0; k < samplesPerChunk && sample < sampleCount; k++) {
      offsets[sample] = at;
      at += sizes[sample];
      sample++;
    }
  }

  if (sample !== sampleCount) {
    throw new Error(
      `Sample tables inconsistent: mapped ${sample} of ${sampleCount} samples.`,
    );
  }

  return offsets;
}

/** Copy a box byte-for-byte and run in-place writes against the copy. */
function copyBox(b, box, patch) {
  const out = Buffer.from(b.subarray(box.start, box.end));
  if (patch) patch(out, box.content - box.start);
  return out;
}

function buildStts(entries) {
  const content = Buffer.alloc(8 + entries.length * 8);
  content.writeUInt32BE(entries.length, 4);

  let at = 8;
  for (const e of entries) {
    content.writeUInt32BE(u32(e.count, 'stts count'), at);
    content.writeUInt32BE(u32(e.duration, 'stts duration'), at + 4);
    at += 8;
  }

  return makeBox('stts', content);
}

function buildCtts(sampleCount, offset) {
  const content = Buffer.alloc(16);
  content.writeUInt32BE(1, 4);
  content.writeUInt32BE(u32(sampleCount, 'ctts count'), 8);
  content.writeUInt32BE(u32(offset, 'ctts offset'), 12);
  return makeBox('ctts', content);
}

function buildStsc(sampleCount) {
  const content = Buffer.alloc(20);
  content.writeUInt32BE(1, 4);
  content.writeUInt32BE(1, 8);
  content.writeUInt32BE(u32(sampleCount, 'stsc samples per chunk'), 12);
  content.writeUInt32BE(1, 16);
  return makeBox('stsc', content);
}

function buildStsz(sizes) {
  const content = Buffer.alloc(12 + sizes.length * 4);
  content.writeUInt32BE(0, 4);
  content.writeUInt32BE(u32(sizes.length, 'stsz count'), 8);

  let at = 12;
  for (const size of sizes) {
    content.writeUInt32BE(u32(size, 'stsz size'), at);
    at += 4;
  }

  return makeBox('stsz', content);
}

function buildStco(offset) {
  const content = Buffer.alloc(12);
  content.writeUInt32BE(1, 4);
  content.writeUInt32BE(u32(offset, 'stco offset'), 8);
  const box = makeBox('stco', content);
  return { box, valueAt: 8 + 8 };
}

function buildCo64(offset) {
  const content = Buffer.alloc(16);
  content.writeUInt32BE(1, 4);
  content.writeBigUInt64BE(BigInt(offset), 8);
  const box = makeBox('co64', content);
  return { box, valueAt: 8 + 8 };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const positional = [];

let startMode = 'ctts';
let fillerCount = 4239;
let fillerDuration = 1;
let fillerHex = '0000000400000000';
let speedFactor = 2;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--start-mode') {
    startMode = args[++i];
    if (!['ctts', 'zero', 'clone'].includes(startMode)) {
      throw new Error(`Unknown start mode: ${startMode}`);
    }
  } else if (arg === '--filler-count') {
    fillerCount = Number(args[++i]);
  } else if (arg === '--filler-duration') {
    fillerDuration = Number(args[++i]);
  } else if (arg === '--filler-hex') {
    fillerHex = args[++i].replace(/\s+/g, '');
  } else if (arg === '--speed-factor') {
    speedFactor = Number(args[++i]);
  } else {
    positional.push(arg);
  }
}

const inputPath = positional[0];
const outputPath = positional[1];

if (!inputPath || !outputPath) {
  console.error(
    'Usage: node tools/build-rtx-second-aac.js INPUT.mp4 OUTPUT.mp4 ' +
    '[--start-mode ctts|zero|clone] [--filler-count 4239] ' +
    '[--filler-duration 1] [--filler-hex 0000000400000000] [--speed-factor 2]',
  );
  process.exit(1);
}

if (!Number.isInteger(fillerCount) || fillerCount < 1 || !Number.isInteger(fillerDuration) || fillerDuration < 1 || !Number.isInteger(speedFactor) || speedFactor < 1) {
  throw new Error('filler-count, filler-duration and speed-factor must be positive integers.');
}

const filler = Buffer.from(fillerHex, 'hex');
if (!filler.length || filler.length % 2 === 1) {
  throw new Error(`Invalid filler hex payload: ${fillerHex}`);
}

const input = await readFile(inputPath);

// ---------------------------------------------------------------------------
// Parse the movie
// ---------------------------------------------------------------------------

let moov = null;
const topBoxes = [];

readBoxes(input, 0, input.length, (box) => {
  topBoxes.push(box);
  if (box.type === 'moov') moov = box;
});

if (!moov) throw new Error('No moov box found.');

const lastBox = topBoxes[topBoxes.length - 1];

let mvhdBox = null;
const trakBoxes = [];

readBoxes(input, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') mvhdBox = box;
  if (box.type === 'trak') trakBoxes.push(box);
});

if (!mvhdBox) throw new Error('No mvhd box found.');

const mvhdVersion = input[mvhdBox.content];
const movieTimescale = input.readUInt32BE(
  mvhdBox.content + (mvhdVersion === 1 ? 20 : 12),
);
const mvhdNextTrackIdOffset =
  mvhdBox.content + (mvhdVersion === 1 ? 108 : 96);

const trakInfos = trakBoxes.map((box) => ({ box, info: scanTrak(input, box) }));
const audioTraks = trakInfos.filter((t) => t.info.handler === 'soun');

if (audioTraks.length !== 1) {
  throw new Error(
    `Expected exactly one audio track, found ${audioTraks.length}.`,
  );
}

const audio1 = audioTraks[0];
const a1 = audio1.info;

if (!a1.tkhd || !a1.mdhd || !a1.elst || !a1.stbl) {
  throw new Error('Audio track is missing tkhd/mdhd/elst/stbl.');
}

const stbl1 = scanStbl(input, a1.stbl);
if (!stbl1.stts || !stbl1.stsz || !stbl1.stsc || !(stbl1.stco || stbl1.co64)) {
  throw new Error('Audio stbl is missing stts/stsz/stsc/stco.');
}
if (stbl1.ctts) {
  throw new Error(
    'Audio track unexpectedly has a ctts box — not supported by this experiment.',
  );
}
if (!stbl1.stsd) {
  throw new Error('Audio stbl has no stsd box.');
}

// ---------------------------------------------------------------------------
// Read + scale the first audio track's timing
// ---------------------------------------------------------------------------

const mdhd = mdhdInfo(input, a1.mdhd);
const tkhd = tkhdInfo(input, a1.tkhd);
const elst = elstInfo(input, a1.elst);

const sttsBefore = readStts(input, stbl1.stts);
const mediaTotalBefore = sttsBefore.reduce((a, e) => a + e.count * e.duration, 0);

if (mdhd.duration !== mediaTotalBefore) {
  console.error(
    `warning: audio mdhd duration ${mdhd.duration} != stts total ${mediaTotalBefore}; using stts total.`,
  );
}

const sttsScaled = sttsBefore.map((e) => ({
  count: e.count,
  duration: u32(e.duration * speedFactor, 'scaled stts duration'),
}));
const mediaTotalAfter = mediaTotalBefore * speedFactor;

// The elst media time is trusted from the input: for the reference pipeline it
// has already been set to the RTXFury target (4224) by patch-rtx-movie-time.
const mediaTime = elst.mediaTime;
if (mediaTime < 0) {
  throw new Error(`Audio elst media_time is negative: ${mediaTime}`);
}

const editDuration = Math.round(
  ((mediaTotalAfter - mediaTime) * movieTimescale) / mdhd.timescale,
);

// ---------------------------------------------------------------------------
// Collect the first track's sample payloads
// ---------------------------------------------------------------------------

const stsz1 = readStsz(input, stbl1.stsz);
const sizes1 = stsz1.uniform
  ? new Array(stsz1.count).fill(stsz1.sampleSize)
  : stsz1.sizes;
const stsc1 = readStsc(input, stbl1.stsc);
const chunkOffsets1 = readChunkOffsets(input, stbl1);
const sampleOffsets1 = sampleOffsets(stsc1, chunkOffsets1, sizes1, stsz1.count);

const realPayload = Buffer.alloc(mediaTotalBefore >= 0 ? sizes1.reduce((a, s) => a + s, 0) : 0);
{
  let cursor = 0;
  for (let i = 0; i < sizes1.length; i++) {
    input.copy(realPayload, cursor, sampleOffsets1[i], sampleOffsets1[i] + sizes1[i]);
    cursor += sizes1[i];
  }
}

// ---------------------------------------------------------------------------
// Build the second track's sample tables and data
// ---------------------------------------------------------------------------

const fillerBytes = filler.length * fillerCount;
const track2Data = Buffer.alloc(realPayload.length + fillerBytes);
realPayload.copy(track2Data, 0);
for (let i = 0; i < fillerCount; i++) {
  filler.copy(track2Data, realPayload.length + i * filler.length);
}

const track2Sizes = sizes1.concat(new Array(fillerCount).fill(filler.length));
const track2SampleCount = track2Sizes.length;

const track2Stts = sttsScaled.map((e) => ({ ...e }));
const lastScaled = track2Stts[track2Stts.length - 1];
if (lastScaled && lastScaled.duration === fillerDuration) {
  lastScaled.count += fillerCount;
} else {
  track2Stts.push({ count: fillerCount, duration: fillerDuration });
}

const track2MediaDuration = mediaTotalAfter + fillerCount * fillerDuration;

const track2MediaTime = startMode === 'zero' ? 0 : mediaTime;
const track2EditDuration = startMode === 'zero'
  ? Math.round((mediaTotalAfter * movieTimescale) / mdhd.timescale)
  : editDuration;

const newTrackId = trakInfos.reduce(
  (max, t) => Math.max(max, tkhdInfo(input, t.info.tkhd).trackId),
  0,
) + 1;

// ---------------------------------------------------------------------------
// Assemble the new trak for the second audio track
// ---------------------------------------------------------------------------

const use64 = Boolean(stbl1.co64);
let track2Stco = null;

function rebuildStbl2() {
  const parts = [];
  let sttsSeen = false;

  readBoxes(input, a1.stbl.content, a1.stbl.end, (box) => {
    if (box.type === 'stsd') {
      parts.push(copyBox(input, box));
      return;
    }

    if (box.type === 'stts') {
      parts.push(buildStts(track2Stts));
      if (startMode === 'ctts') {
        parts.push(buildCtts(track2SampleCount, track2MediaTime));
      }
      sttsSeen = true;
      return;
    }

    if (box.type === 'stsc') {
      parts.push(buildStsc(track2SampleCount));
      return;
    }

    if (box.type === 'stsz') {
      parts.push(buildStsz(track2Sizes));
      return;
    }

    if (box.type === 'stco' || box.type === 'co64') {
      track2Stco = use64 ? buildCo64(0) : buildStco(0);
      parts.push(track2Stco.box);
      return;
    }

    if (box.type === 'sgpd' || box.type === 'sbgp') {
      // Roll/priming groups of track 1 are not copied to track 2.
      return;
    }

    parts.push(copyBox(input, box));
  });

  if (!sttsSeen) throw new Error('stts disappeared while rebuilding stbl.');

  return makeBox('stbl', concat(parts));
}

function rebuildMinf2(minf) {
  const parts = [];

  readBoxes(input, minf.content, minf.end, (box) => {
    if (box.type === 'stbl') {
      parts.push(rebuildStbl2());
      return;
    }
    parts.push(copyBox(input, box));
  });

  return makeBox('minf', concat(parts));
}

function rebuildMdia2(mdia) {
  const parts = [];

  readBoxes(input, mdia.content, mdia.end, (box) => {
    if (box.type === 'mdhd') {
      parts.push(copyBox(input, box, (out, content) => {
        const version = out[content];
        if (version === 1) out.writeBigUInt64BE(BigInt(track2MediaDuration), content + 28);
        else out.writeUInt32BE(u32(track2MediaDuration, 'trak2 mdhd duration'), content + 16);
      }));
      return;
    }

    if (box.type === 'minf') {
      parts.push(rebuildMinf2(box));
      return;
    }

    parts.push(copyBox(input, box));
  });

  return makeBox('mdia', concat(parts));
}

const trak2Parts = [];

readBoxes(input, audio1.box.content, audio1.box.end, (box) => {
  if (box.type === 'tkhd') {
    trak2Parts.push(copyBox(input, box, (out, content) => {
      const version = out[content];
      out.writeUInt32BE(u32(newTrackId, 'trak2 track id'), content + (version === 1 ? 20 : 12));
      if (version === 1) out.writeBigUInt64BE(BigInt(track2EditDuration), content + 28);
      else out.writeUInt32BE(u32(track2EditDuration, 'trak2 tkhd duration'), content + 20);
      // Two tracks in the same alternate group would let players pick only one.
      const altGroupOffset = content + (version === 1 ? 44 : 36);
      if (out.readUInt16BE(altGroupOffset) !== 0) {
        out.writeUInt16BE(0, altGroupOffset);
      }
    }));
    return;
  }

  if (box.type === 'edts') {
    const parts = [];
    readBoxes(input, box.content, box.end, (child) => {
      if (child.type === 'elst') {
        parts.push(copyBox(input, child, (out, content) => {
          const version = out[content];
          if (version === 1) {
            out.writeBigUInt64BE(BigInt(track2EditDuration), content + 8);
            out.writeBigInt64BE(BigInt(track2MediaTime), content + 16);
          } else {
            out.writeUInt32BE(u32(track2EditDuration, 'trak2 elst duration'), content + 8);
            out.writeInt32BE(track2MediaTime, content + 12);
          }
        }));
        return;
      }
      parts.push(copyBox(input, child));
    });
    trak2Parts.push(makeBox('edts', concat(parts)));
    return;
  }

  if (box.type === 'mdia') {
    trak2Parts.push(rebuildMdia2(box));
    return;
  }

  trak2Parts.push(copyBox(input, box));
});

// The moov grows by exactly the size of the new trak. The stco entry's VALUE
// never changes any box size, so the delta is known before trak2 is assembled.
const moovDelta = 8 + trak2Parts.reduce((a, p) => a + p.length, 0);

let mdatMode;
let track2DataStart;

if (lastBox.type === 'mdat') {
  // Extend the final mdat so the new samples live inside it (single mdat).
  mdatMode = 'extended';
  track2DataStart = lastBox.end + moovDelta;
} else {
  // Append a new mdat after the existing boxes.
  mdatMode = 'appended';
  track2DataStart = input.length + moovDelta + 8;
}

if (track2DataStart + track2Data.length > 0xffffffff && !use64) {
  throw new Error('Second track data does not fit in 32-bit stco offsets.');
}

const trak2 = makeBox('trak', concat(trak2Parts));

if (trak2.length !== moovDelta) {
  throw new Error(
    `trak2 size check failed: expected ${moovDelta}, built ${trak2.length}.`,
  );
}

// The leaf stco buffer was frozen by the nested makeBox/concat calls above, so
// write the real chunk offset into the assembled trak2 instead. This must
// happen before the moov parts are concatenated.
{
  const wantedType = use64 ? 'co64' : 'stco';
  const wantedSize = use64 ? 24 : 20;
  let entryAt = -1;

  for (let o = 8; o + wantedSize <= trak2.length; o++) {
    if (trak2.readUInt32BE(o) !== wantedSize) continue;
    if (trak2.toString('ascii', o + 4, o + 8) !== wantedType) continue;
    if (trak2.readUInt32BE(o + 12) !== 1) continue; // entry count
    entryAt = o + 16;
    break;
  }

  if (entryAt < 0) {
    throw new Error('Track 2 chunk offset box not found after assembly.');
  }

  if (use64) {
    trak2.writeBigUInt64BE(BigInt(track2DataStart), entryAt);
  } else {
    trak2.writeUInt32BE(track2DataStart, entryAt);
  }
}

// ---------------------------------------------------------------------------
// Patch the first audio track in place (timing x factor, offsets + delta)
// ---------------------------------------------------------------------------

const trak1Patched = Buffer.from(input.subarray(audio1.box.start, audio1.box.end));
const shift1 = (absolute) => absolute - audio1.box.start;

// stts: scale every duration in place (entry count is unchanged).
{
  let at = stbl1.stts.content + 8;
  for (let i = 0; i < sttsBefore.length; i++) {
    trak1Patched.writeUInt32BE(
      u32(sttsBefore[i].duration * speedFactor, 'stts duration'),
      at - audio1.box.start + 4,
    );
    at += 8;
  }
}

// mdhd duration.
if (mdhd.durationBytes === 8) {
  trak1Patched.writeBigUInt64BE(BigInt(mediaTotalAfter), shift1(mdhd.durationOffset));
} else {
  trak1Patched.writeUInt32BE(u32(mediaTotalAfter, 'mdhd duration'), shift1(mdhd.durationOffset));
}

// elst duration + media time (duration recomputed from scaled media).
if (elst.durationBytes === 8) {
  trak1Patched.writeBigUInt64BE(BigInt(editDuration), shift1(elst.durationOffset));
  trak1Patched.writeBigInt64BE(BigInt(mediaTime), shift1(elst.mediaTimeOffset));
} else {
  trak1Patched.writeUInt32BE(u32(editDuration, 'elst duration'), shift1(elst.durationOffset));
  trak1Patched.writeInt32BE(mediaTime, shift1(elst.mediaTimeOffset));
}

// tkhd duration.
if (tkhd.durationBytes === 8) {
  trak1Patched.writeBigUInt64BE(BigInt(editDuration), shift1(tkhd.durationOffset));
} else {
  trak1Patched.writeUInt32BE(u32(editDuration, 'tkhd duration'), shift1(tkhd.durationOffset));
}

// ---------------------------------------------------------------------------
// Patch every remaining trak's chunk offsets (+ delta)
// ---------------------------------------------------------------------------

function patchOffsetsInCopy(box) {
  const out = Buffer.from(input.subarray(box.start, box.end));

  function scan(start, end) {
    readBoxes(input, start, end, (child) => {
      const local = (absolute) => absolute - box.start;

      if (child.type === 'stco') {
        const count = input.readUInt32BE(child.content + 4);
        let at = child.content + 8;
        for (let i = 0; i < count; i++) {
          const value = input.readUInt32BE(at) + moovDelta;
          out.writeUInt32BE(u32(value, 'stco offset'), local(at));
          at += 4;
        }
      } else if (child.type === 'co64') {
        const count = input.readUInt32BE(child.content + 4);
        let at = child.content + 8;
        for (let i = 0; i < count; i++) {
          out.writeBigUInt64BE(input.readBigUInt64BE(at) + BigInt(moovDelta), local(at));
          at += 8;
        }
      }

      if (['trak', 'mdia', 'minf', 'stbl', 'edts'].includes(child.type)) {
        scan(child.content, child.end);
      }
    });
  }

  scan(box.content, box.end);
  return out;
}

// The audio track's own offsets also shift; patch them inside trak1Patched.
{
  const box = stbl1.stco || stbl1.co64;
  const count = input.readUInt32BE(box.content + 4);
  let at = box.content + 8;
  for (let i = 0; i < count; i++) {
    if (stbl1.stco) {
      const value = input.readUInt32BE(at) + moovDelta;
      trak1Patched.writeUInt32BE(u32(value, 'audio stco offset'), shift1(at));
      at += 4;
    } else {
      trak1Patched.writeBigUInt64BE(
        input.readBigUInt64BE(at) + BigInt(moovDelta),
        shift1(at),
      );
      at += 8;
    }
  }
}

// ---------------------------------------------------------------------------
// Assemble the new moov
// ---------------------------------------------------------------------------

const moovParts = [];

readBoxes(input, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') {
    const mv = Buffer.from(input.subarray(box.start, box.end));
    mv.writeUInt32BE(u32(newTrackId + 1, 'next track id'), mvhdNextTrackIdOffset - box.start);
    moovParts.push(mv);
    return;
  }

  if (box.type === 'trak') {
    if (box.start === audio1.box.start) {
      moovParts.push(trak1Patched);
      moovParts.push(trak2);
      return;
    }
    moovParts.push(patchOffsetsInCopy(box));
    return;
  }

  moovParts.push(Buffer.from(input.subarray(box.start, box.end)));
});

const newMoov = makeBox('moov', concat(moovParts));

if (newMoov.length !== moov.size + moovDelta) {
  throw new Error(
    `Moov size check failed: expected ${moov.size + moovDelta}, built ${newMoov.length}.`,
  );
}

// ---------------------------------------------------------------------------
// Assemble the output file
// ---------------------------------------------------------------------------

let output;

if (mdatMode === 'extended') {
  output = concat([
    input.subarray(0, moov.start),
    newMoov,
    input.subarray(moov.end),
    track2Data,
  ]);

  const sizeFieldAt = lastBox.start + moovDelta;
  if (lastBox.header === 8) {
    output.writeUInt32BE(
      u32(lastBox.size + track2Data.length, 'mdat size'),
      sizeFieldAt,
    );
  } else {
    output.writeBigUInt64BE(
      BigInt(lastBox.size + track2Data.length),
      sizeFieldAt + 8,
    );
  }
} else {
  output = concat([
    input.subarray(0, moov.start),
    newMoov,
    input.subarray(moov.end),
    makeBox('mdat', track2Data),
  ]);
}

await writeFile(outputPath, output);

const fmtEntries = (entries) => entries.map((e) => `${e.count}x${e.duration}`).join(', ');

console.log(JSON.stringify({
  inputBytes: input.length,
  outputBytes: output.length,
  speedFactor,
  audioTimescale: mdhd.timescale,
  movieTimescale,
  startMode,
  track1: {
    trackId: tkhd.trackId,
    sampleCount: stsz1.count,
    sttsBefore: fmtEntries(sttsBefore),
    sttsAfter: fmtEntries(sttsScaled),
    mediaDurationBefore: mediaTotalBefore,
    mediaDurationAfter: mediaTotalAfter,
    elstBefore: { duration: elst.duration, mediaTime: elst.mediaTime },
    elstAfter: { duration: editDuration, mediaTime },
  },
  track2: {
    trackId: newTrackId,
    sampleCount: track2SampleCount,
    copiedSamples: stsz1.count,
    fillerCount,
    fillerDuration,
    fillerHex,
    stts: fmtEntries(track2Stts),
    mediaDuration: track2MediaDuration,
    elst: { duration: track2EditDuration, mediaTime: track2MediaTime },
    ctts: startMode === 'ctts' ? { count: track2SampleCount, offset: track2MediaTime } : null,
    dataStart: track2DataStart,
    dataBytes: track2Data.length,
    droppedBoxes: stbl1.dropped,
  },
  mdat: { mode: mdatMode, addedBytes: track2Data.length },
  moovDelta,
  nextTrackId: newTrackId + 1,
  notes: [
    'Track 1 elst media_time is trusted from the input (RTXFury target 4224 for the reference source).',
    'Track 2 payload bytes are a fresh copy of track 1 samples plus fillers (offsets are not shared with track 1).',
    'sgpd/sbgp roll groups are not copied to track 2.',
  ],
}, null, 2));
