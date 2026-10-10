/**
 * RTXFury second-AAC-track experiment (v2 — matched to the real reference
 * box dump of rtxfury-matching-1790458373247510.mp4, 2026-09-29).
 *
 * Input:  an MP4 that has already been through the documented video-side
 *         experiment chain (faststartRemux(isoSignature) ->
 *         applyRtxDurationExperiment -> patchVideoEditList ->
 *         tools/split-last-stts.js -> tools/patch-rtx-movie-time.js) with
 *         exactly one audio ('soun') track still at source timing.
 *
 * Output: the same file with
 *   1. the existing AAC track scaled by the speed factor (default 2) with the
 *      FINAL SAMPLE TRIMMED so the media timeline ends exactly at the edit
 *      list end (reference: 471x1024 -> 470x2048 + 1x512, because
 *      4224 + 19976ms * 48 = 963072 = 470*2048 + 512);
 *   2. the audio track re-chunked like the reference (one sample per chunk,
 *      last chunk holding two: stsc [(1,1),(N-1,2)], N-1 chunk offsets);
 *   3. a NEW second audio trak that shares the first track's chunk offsets
 *      (NO duplicated payload bytes) plus one appended filler chunk of
 *      4239 samples x 8 bytes (default payload 0000000400000000, 1 tick
 *      each) — exactly the observed RTXFury layout:
 *        stts  470x2048, 1x512, 4239x1
 *        stsc  (1,1),(470,2),(471,4239)
 *        stco  471 entries (470 shared + 1 filler block)
 *        mdhd  duration = edit duration in media ticks (958848)
 *        tkhd  duration = edit duration (19976)
 *        NO edts/elst, NO ctts  (plain track: DTS 0, pts == dts,
 *        no skip-samples side data)
 *        sgpd/sbgp copied from track 1;
 *   4. filler bytes appended at EOF OUTSIDE the declared mdat, matching the
 *      reference (mdat size unchanged; demuxers read via stco). Use
 *      --filler-layout mdat to extend the mdat instead (v1 behaviour).
 *
 * Start modes (--start-mode):
 *   plain (default) no elst, no ctts on track 2 — REFERENCE-MATCHED.
 *   zero            elst (editDuration, 0) — fallback experiment.
 *   clone           elst copied from track 1 (negative DTS + skip) — A/B.
 *   ctts            elst + ctts offset (v1 theory, disproven by the
 *                   reference dump; kept only for comparison).
 *
 * The elst duration/media_time of track 1 are TRUSTED from the input (they
 * are the already-patched RTXFury targets 19976/4224 in this pipeline).
 *
 * Usage:
 *   node tools/build-rtx-second-aac.js INPUT.mp4 OUTPUT.mp4 \
 *     [--start-mode plain|zero|clone|ctts] [--filler-count 4239] \
 *     [--filler-duration 1] [--filler-hex 0000000400000000] \
 *     [--speed-factor 2] [--filler-layout eof|mdat]
 */
import { readFile, writeFile, open, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';

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

function scanTrak(b, trak) {
  const result = { handler: null, tkhd: null, mdhd: null, elst: null, stbl: null };

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
      if (['trak', 'mdia', 'minf', 'stbl', 'edts'].includes(box.type)) {
        scan(box.content, box.end);
      }
    });
  }

  scan(trak.content, trak.end);
  return result;
}

function scanStbl(b, stbl) {
  const result = { stsd: null, stts: null, ctts: null, stsc: null, stsz: null, stco: null, co64: null };
  readBoxes(b, stbl.content, stbl.end, (box) => {
    if (box.type === 'stsd') result.stsd = box;
    if (box.type === 'stts') result.stts = box;
    if (box.type === 'ctts') result.ctts = box;
    if (box.type === 'stsc') result.stsc = box;
    if (box.type === 'stsz') result.stsz = box;
    if (box.type === 'stco') result.stco = box;
    if (box.type === 'co64') result.co64 = box;
  });
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
  if (count !== 1) throw new Error(`Expected exactly one elst entry, found ${count}.`);
  if (version === 1) {
    return {
      version,
      duration: Number(b.readBigUInt64BE(box.content + 8)),
      mediaTime: Number(b.readBigInt64BE(box.content + 16)),
    };
  }
  return {
    version,
    duration: b.readUInt32BE(box.content + 8),
    mediaTime: b.readInt32BE(box.content + 12),
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
  if (sampleSize !== 0) return { uniform: true, sampleSize, count, sizes: null };
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

function readChunkOffsets(b, stco, co64) {
  const box = stco || co64;
  if (!box) throw new Error('Audio track has no stco/co64 table.');
  const count = b.readUInt32BE(box.content + 4);
  const offsets = [];
  let at = box.content + 8;
  for (let i = 0; i < count; i++) {
    if (stco) {
      offsets.push(b.readUInt32BE(at));
      at += 4;
    } else {
      offsets.push(Number(b.readBigUInt64BE(at)));
      at += 8;
    }
  }
  return offsets;
}

function sampleOffsets(stscEntries, chunkOffsets, sizes, sampleCount) {
  const offsets = new Array(sampleCount);
  let sample = 0;
  for (let chunk = 0; chunk < chunkOffsets.length && sample < sampleCount; chunk++) {
    const chunkNumber = chunk + 1;
    let samplesPerChunk = stscEntries.length
      ? stscEntries[stscEntries.length - 1].samplesPerChunk
      : 1;
    for (let e = 0; e < stscEntries.length; e++) {
      const next = e + 1 < stscEntries.length ? stscEntries[e + 1].firstChunk : Infinity;
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
    throw new Error(`Sample tables inconsistent: mapped ${sample} of ${sampleCount} samples.`);
  }
  return offsets;
}

function copyBox(b, box, patch) {
  const out = Buffer.from(b.subarray(box.start, box.end));
  if (patch) patch(out, box.content - box.start);
  return out;
}

// ---------------------------------------------------------------------------
// Box builders
// ---------------------------------------------------------------------------

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

function buildStsc(entries) {
  const content = Buffer.alloc(8 + entries.length * 12);
  content.writeUInt32BE(entries.length, 4);
  let at = 8;
  for (const e of entries) {
    content.writeUInt32BE(u32(e.firstChunk, 'stsc firstChunk'), at);
    content.writeUInt32BE(u32(e.samplesPerChunk, 'stsc samplesPerChunk'), at + 4);
    content.writeUInt32BE(u32(e.sampleDescriptionIndex || 1, 'stsc sdi'), at + 8);
    at += 12;
  }
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

function buildChunkOffsets(offsets, use64) {
  const width = use64 ? 8 : 4;
  const content = Buffer.alloc(8 + offsets.length * width);
  content.writeUInt32BE(u32(offsets.length, 'stco count'), 4);
  const box = makeBox(use64 ? 'co64' : 'stco', content);
  return { box, type: use64 ? 'co64' : 'stco', count: offsets.length, width, entriesAt: 16 };
}

function buildCtts(sampleCount, offset) {
  const content = Buffer.alloc(16);
  content.writeUInt32BE(1, 4);
  content.writeUInt32BE(u32(sampleCount, 'ctts count'), 8);
  content.writeUInt32BE(u32(offset, 'ctts offset'), 12);
  return makeBox('ctts', content);
}

/**
 * Rebuild one audio trak from the source audio trak.
 * opts:
 *   trackId       new track id for tkhd
 *   tkhdDuration  tkhd duration (movie timescale ticks)
 *   elst          null = omit edts entirely; 'keep' = copy unchanged;
 *                 {duration, mediaTime} = write these values
 *   mdhdDuration  mdhd duration (media timescale ticks)
 *   sttsEntries   replacement stts entries
 *   stscEntries   replacement stsc entries
 *   stszSizes     replacement stsz sizes (null = keep source stsz)
 *   stcoOffsets   replacement chunk offsets (placeholder values allowed;
 *                 patchStco() rewrites them after assembly)
 *   ctts          {count, offset} or null
 * Returns { buffer, stco: {type, count, width} } — stco located by signature.
 */
function buildAudioTrak(b, srcTrak, srcStblBox, srcStbl, opts) {
  const use64 = Boolean(srcStbl.co64);
  const offsetBox = buildChunkOffsets(opts.stcoOffsets, use64);

  function rebuildStbl() {
    const parts = [];
    readBoxes(b, srcStblBox.content, srcStblBox.end, (box) => {
      if (box.type === 'stsd') { parts.push(copyBox(b, box)); return; }
      if (box.type === 'stts') {
        parts.push(buildStts(opts.sttsEntries));
        if (opts.ctts) parts.push(buildCtts(opts.ctts.count, opts.ctts.offset));
        return;
      }
      if (box.type === 'ctts') return; // replaced above when requested
      if (box.type === 'stsc') { parts.push(buildStsc(opts.stscEntries)); return; }
      if (box.type === 'stsz') {
        if (opts.stszSizes) parts.push(buildStsz(opts.stszSizes));
        else parts.push(copyBox(b, box));
        return;
      }
      if (box.type === 'stco' || box.type === 'co64') { parts.push(offsetBox.box); return; }
      parts.push(copyBox(b, box)); // sgpd/sbgp and everything else are kept
    });
    return makeBox('stbl', concat(parts));
  }

  function rebuildMinf(minf) {
    const parts = [];
    readBoxes(b, minf.content, minf.end, (box) => {
      if (box.type === 'stbl') { parts.push(rebuildStbl()); return; }
      parts.push(copyBox(b, box));
    });
    return makeBox('minf', concat(parts));
  }

  function rebuildMdia(mdia) {
    const parts = [];
    readBoxes(b, mdia.content, mdia.end, (box) => {
      if (box.type === 'mdhd') {
        parts.push(copyBox(b, box, (out, content) => {
          const version = out[content];
          if (version === 1) out.writeBigUInt64BE(BigInt(opts.mdhdDuration), content + 24);
          else out.writeUInt32BE(u32(opts.mdhdDuration, 'mdhd duration'), content + 16);
        }));
        return;
      }
      if (box.type === 'minf') { parts.push(rebuildMinf(box)); return; }
      parts.push(copyBox(b, box));
    });
    return makeBox('mdia', concat(parts));
  }

  const trakParts = [];
  readBoxes(b, srcTrak.content, srcTrak.end, (box) => {
    if (box.type === 'tkhd') {
      trakParts.push(copyBox(b, box, (out, content) => {
        const version = out[content];
        out.writeUInt32BE(u32(opts.trackId, 'track id'), content + (version === 1 ? 20 : 12));
        if (version === 1) out.writeBigUInt64BE(BigInt(opts.tkhdDuration), content + 28);
        else out.writeUInt32BE(u32(opts.tkhdDuration, 'tkhd duration'), content + 20);
        const altGroupOffset = content + (version === 1 ? 44 : 36);
        if (out.readUInt16BE(altGroupOffset) !== 0) out.writeUInt16BE(0, altGroupOffset);
      }));
      return;
    }

    if (box.type === 'edts') {
      if (opts.elst === null) return; // plain mode: no edit list at all
      const parts = [];
      readBoxes(b, box.content, box.end, (child) => {
        if (child.type === 'elst') {
          if (opts.elst === 'keep') { parts.push(copyBox(b, child)); return; }
          parts.push(copyBox(b, child, (out, content) => {
            const version = out[content];
            if (version === 1) {
              out.writeBigUInt64BE(BigInt(opts.elst.duration), content + 8);
              out.writeBigInt64BE(BigInt(opts.elst.mediaTime), content + 16);
            } else {
              out.writeUInt32BE(u32(opts.elst.duration, 'elst duration'), content + 8);
              out.writeInt32BE(opts.elst.mediaTime, content + 12);
            }
          }));
          return;
        }
        parts.push(copyBox(b, child));
      });
      trakParts.push(makeBox('edts', concat(parts)));
      return;
    }

    if (box.type === 'mdia') { trakParts.push(rebuildMdia(box)); return; }
    trakParts.push(copyBox(b, box));
  });

  return { buffer: makeBox('trak', concat(trakParts)), stco: { type: offsetBox.type, count: offsetBox.count, width: offsetBox.width } };
}

/** Locate the freshly built stco/co64 box inside a trak buffer and rewrite
 *  its entries. Placeholder build must have a unique (type, count) pair. */
function patchStco(trakBuffer, stcoMeta, values) {
  if (values.length !== stcoMeta.count) {
    throw new Error(`stco patch length mismatch: ${values.length} != ${stcoMeta.count}`);
  }
  const wantedSize = 8 + 4 + 4 + stcoMeta.count * stcoMeta.width;
  let entryAt = -1;
  for (let o = 8; o + wantedSize <= trakBuffer.length; o++) {
    if (trakBuffer.readUInt32BE(o) !== wantedSize) continue;
    if (trakBuffer.toString('ascii', o + 4, o + 8) !== stcoMeta.type) continue;
    if (trakBuffer.readUInt32BE(o + 12) !== stcoMeta.count) continue;
    entryAt = o + 16;
    break;
  }
  if (entryAt < 0) throw new Error('Built chunk offset box not found in trak buffer.');
  values.forEach((v, i) => {
    if (stcoMeta.width === 8) trakBuffer.writeBigUInt64BE(BigInt(v), entryAt + i * 8);
    else trakBuffer.writeUInt32BE(u32(v, 'chunk offset'), entryAt + i * 4);
  });
}

/**
 * Reference-matched mvhd: version 1 (120 bytes), creation/modification 0,
 * duration = 0xFFFFFFFFFFFFFFFF ("unknown"). This is what makes the RTXFury
 * output show no playtime in phone galleries while TikTok Studio still
 * accepts it. Verified byte-by-byte against the reference xxd dump.
 */
function buildMvhdV1Unknown(timescale, nextTrackId) {
  const c = Buffer.alloc(112);
  c.writeUInt8(1, 0);                          // version 1, flags 0
  // creation_time (8) and modification_time (8) stay 0
  c.writeUInt32BE(u32(timescale, 'mvhd timescale'), 20);
  c.writeBigUInt64BE(0xFFFFFFFFFFFFFFFFn, 24); // duration = unknown
  c.writeUInt32BE(0x00010000, 32);             // rate 1.0
  c.writeUInt16BE(0x0100, 36);                 // volume 1.0
  // reserved (10) stay 0
  c.writeUInt32BE(0x00010000, 48);             // matrix a
  c.writeUInt32BE(0x00010000, 64);             // matrix w
  c.writeUInt32BE(0x40000000, 80);             // matrix perspective
  // pre_defined (24) stay 0
  c.writeUInt32BE(u32(nextTrackId, 'next track id'), 108);
  return makeBox('mvhd', c);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const positional = [];
let startMode = 'plain';
let fillerCount = 4239;
let fillerDuration = 1;
let fillerHex = '0000000400000000';
let speedFactor = 2;
let fillerLayout = 'eof';
let mvhdV1Unknown = false;
let dropUdta = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--start-mode') {
    startMode = args[++i];
    if (!['plain', 'zero', 'clone', 'ctts'].includes(startMode)) {
      throw new Error(`Unknown start mode: ${startMode}`);
    }
  } else if (arg === '--filler-count') fillerCount = Number(args[++i]);
  else if (arg === '--filler-duration') fillerDuration = Number(args[++i]);
  else if (arg === '--filler-hex') fillerHex = args[++i].replace(/\s+/g, '');
  else if (arg === '--speed-factor') speedFactor = Number(args[++i]);
  else if (arg === '--filler-layout') {
    fillerLayout = args[++i];
    if (!['eof', 'mdat'].includes(fillerLayout)) throw new Error(`Unknown filler layout: ${fillerLayout}`);
  } else if (arg === '--mvhd-v1-unknown') mvhdV1Unknown = true;
  else if (arg === '--drop-udta') dropUdta = true;
  else positional.push(arg);
}

const inputPath = positional[0];
const outputPath = positional[1];

if (!inputPath || !outputPath) {
  console.error(
    'Usage: node tools/build-rtx-second-aac.js INPUT.mp4 OUTPUT.mp4 ' +
    '[--start-mode plain|zero|clone|ctts] [--filler-count 4239] ' +
    '[--filler-duration 1] [--filler-hex 0000000400000000] [--speed-factor 2] ' +
    '[--filler-layout eof|mdat]',
  );
  process.exit(1);
}

if (!Number.isInteger(fillerCount) || fillerCount < 1 ||
    !Number.isInteger(fillerDuration) || fillerDuration < 1 ||
    !Number.isInteger(speedFactor) || speedFactor < 1) {
  throw new Error('filler-count, filler-duration and speed-factor must be positive integers.');
}

const filler = Buffer.from(fillerHex, 'hex');
if (!filler.length || filler.length % 2 === 1) {
  throw new Error(`Invalid filler hex payload: ${fillerHex}`);
}

const fh = await open(inputPath, 'r');
const inputStat = await fh.stat();
let o = 0;
const hBuf = Buffer.alloc(16);
let moov = null;
const topBoxes = [];
while (o < inputStat.size) {
  const { bytesRead } = await fh.read(hBuf, 0, 8, o);
  if (bytesRead < 8) break;
  let size = hBuf.readUInt32BE(0);
  const type = hBuf.toString('ascii', 4, 8);
  let header = 8;
  if (size === 1) {
    await fh.read(hBuf, 8, 8, o + 8);
    size = Number(hBuf.readBigUInt64BE(8));
    header = 16;
  } else if (size === 0) {
    size = inputStat.size - o;
  }
  const box = { type, start: o, end: o + size, size, header, content: o + header };
  topBoxes.push(box);
  if (type === 'moov') {
    moov = box;
    break;
  }
  o += size;
}

if (!moov) {
  await fh.close();
  throw new Error('No moov box found.');
}
if (moov.start > 1024) {
  await fh.close();
  throw new Error('Expected faststart MP4 with moov near the front.');
}

const input = Buffer.alloc(moov.end);
await fh.read(input, 0, moov.end, 0);
await fh.close();
const lastBox = topBoxes[topBoxes.length - 1];

let mvhdBox = null;
const trakBoxes = [];
readBoxes(input, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') mvhdBox = box;
  if (box.type === 'trak') trakBoxes.push(box);
});
if (!mvhdBox) throw new Error('No mvhd box found.');

const mvhdVersion = input[mvhdBox.content];
const movieTimescale = input.readUInt32BE(mvhdBox.content + (mvhdVersion === 1 ? 20 : 12));
const mvhdNextTrackIdOffset = mvhdBox.content + (mvhdVersion === 1 ? 108 : 96);

const trakInfos = trakBoxes.map((box) => ({ box, info: scanTrak(input, box) }));
const audioTraks = trakInfos.filter((t) => t.info.handler === 'soun');
if (audioTraks.length !== 1) {
  throw new Error(`Expected exactly one audio track, found ${audioTraks.length}.`);
}

const audio1 = audioTraks[0];
const a1 = audio1.info;
if (!a1.tkhd || !a1.mdhd || !a1.stbl) throw new Error('Audio track is missing tkhd/mdhd/stbl.');
if (!a1.elst) throw new Error('Audio track has no edit list — this experiment expects the patched elst.');

const stbl1 = scanStbl(input, a1.stbl);
if (!stbl1.stts || !stbl1.stsz || !stbl1.stsc || !(stbl1.stco || stbl1.co64)) {
  throw new Error('Audio stbl is missing stts/stsz/stsc/stco.');
}
if (stbl1.ctts) throw new Error('Audio track unexpectedly has a ctts box.');
if (!stbl1.stsd) throw new Error('Audio stbl has no stsd box.');

// ---------------------------------------------------------------------------
// Timing: scale, then trim/extend the final sample so the media timeline ends
// exactly at the edit-list end (reference: 470x2048 + 1x512 = 4224 + 19976ms*48)
// ---------------------------------------------------------------------------

const mdhd = mdhdInfo(input, a1.mdhd);
const tkhd = tkhdInfo(input, a1.tkhd);
const elst = elstInfo(input, a1.elst);
const sttsBefore = readStts(input, stbl1.stts);

const mediaTime = elst.mediaTime;         // trusted (RTXFury target 4224)
const editDuration = elst.duration;       // trusted (RTXFury target 19976)
if (mediaTime < 0) throw new Error(`Audio elst media_time is negative: ${mediaTime}`);

const editDurationTicks = Math.round((editDuration * mdhd.timescale) / movieTimescale);
const targetTotal = mediaTime + editDurationTicks;

const sttsScaled = sttsBefore.map((e) => ({
  count: e.count,
  duration: u32(e.duration * speedFactor, 'scaled stts duration'),
}));

const stsz1 = readStsz(input, stbl1.stsz);
const sizes1 = stsz1.uniform ? new Array(stsz1.count).fill(stsz1.sampleSize) : stsz1.sizes;
const N = stsz1.count;

const stsc1 = readStsc(input, stbl1.stsc);
const chunkOffsets1 = readChunkOffsets(input, stbl1.stco, stbl1.co64);
const perSampleOffsets = sampleOffsets(stsc1, chunkOffsets1, sizes1, N);

// Flatten the scaled durations, drop samples that start at/after the edit end,
// trim the boundary sample, and stretch the last sample if the audio is short.
const flatDurations = [];
for (const e of sttsScaled) {
  for (let i = 0; i < e.count; i++) flatDurations.push(e.duration);
}
if (flatDurations.length !== N) {
  throw new Error(`stts sample count ${flatDurations.length} != stsz count ${N}.`);
}

const keptDurations = [];
let droppedSamples = 0;
let cursor = 0;
for (let i = 0; i < flatDurations.length; i++) {
  if (cursor >= targetTotal) {
    droppedSamples = flatDurations.length - i;
    break;
  }
  if (cursor + flatDurations[i] > targetTotal) {
    // boundary sample: keep the part inside the edit window
    keptDurations.push(targetTotal - cursor);
    droppedSamples = flatDurations.length - i - 1;
    cursor = targetTotal;
    break;
  }
  keptDurations.push(flatDurations[i]);
  cursor += flatDurations[i];
}
if (!keptDurations.length) {
  throw new Error('The audio edit window contains no complete sample.');
}
if (cursor < targetTotal) {
  keptDurations[keptDurations.length - 1] += targetTotal - cursor;
  cursor = targetTotal;
}

const keptCount = keptDurations.length;
if (droppedSamples > 0) {
  console.error(
    `warning: ${droppedSamples} trailing audio sample(s) start at/after the edit end and are dropped.`,
  );
}

// Merge consecutive equal durations into stts entries.
const sttsTrimmed = [];
for (const d of keptDurations) {
  const last = sttsTrimmed[sttsTrimmed.length - 1];
  if (last && last.duration === d) last.count += 1;
  else sttsTrimmed.push({ count: 1, duration: d });
}
const mediaTotalAfter = sttsTrimmed.reduce((a, e) => a + e.count * e.duration, 0);
if (mediaTotalAfter !== targetTotal) {
  throw new Error(`Trimmed total ${mediaTotalAfter} != target ${targetTotal}.`);
}

// ---------------------------------------------------------------------------
// Sample data (shared, not duplicated)
// ---------------------------------------------------------------------------

const keptSizes = sizes1.slice(0, keptCount);
const keptOffsets = perSampleOffsets.slice(0, keptCount);

// Reference chunk layout: one sample per chunk, final chunk holds two samples.
let track1ChunkCount;
const stscShared = [{ firstChunk: 1, samplesPerChunk: 1, sampleDescriptionIndex: 1 }];
if (keptCount === 1) {
  track1ChunkCount = 1;
} else if (keptCount === 2) {
  track1ChunkCount = 1;
  stscShared[0].samplesPerChunk = 2;
} else {
  track1ChunkCount = keptCount - 1;
  stscShared.push({ firstChunk: track1ChunkCount, samplesPerChunk: 2, sampleDescriptionIndex: 1 });
}
const sharedChunkOffsets = keptOffsets.slice(0, track1ChunkCount); // first sample of each chunk

const fillerBytes = Buffer.alloc(filler.length * fillerCount);
for (let i = 0; i < fillerCount; i++) filler.copy(fillerBytes, i * filler.length);

const track2Sizes = keptSizes.concat(new Array(fillerCount).fill(filler.length));
const track2SampleCount = track2Sizes.length;

const track2Stts = sttsTrimmed.slice();
const lastTrimmed = track2Stts[track2Stts.length - 1];
if (lastTrimmed.duration === fillerDuration) lastTrimmed.count += fillerCount;
else track2Stts.push({ count: fillerCount, duration: fillerDuration });
const track2SttsSum = track2Stts.reduce((a, e) => a + e.count * e.duration, 0);

const track2Stsc = stscShared.concat([{
  firstChunk: track1ChunkCount + 1,
  samplesPerChunk: fillerCount,
  sampleDescriptionIndex: 1,
}]);

const newTrackId = trakInfos.reduce(
  (max, t) => Math.max(max, tkhdInfo(input, t.info.tkhd).trackId), 0,
) + 1;

// ---------------------------------------------------------------------------
// Build both traks (chunk offsets still placeholders)
// ---------------------------------------------------------------------------

const trak1New = buildAudioTrak(input, audio1.box, a1.stbl, stbl1, {
  trackId: tkhd.trackId,
  tkhdDuration: editDuration,
  elst: 'keep',
  mdhdDuration: mediaTotalAfter,
  sttsEntries: sttsTrimmed,
  stscEntries: stscShared,
  stszSizes: keptSizes,
  stcoOffsets: sharedChunkOffsets,
  ctts: null,
});

const track2Elst =
  startMode === 'plain' ? null :
  startMode === 'zero' ? { duration: editDuration, mediaTime: 0 } :
  { duration: editDuration, mediaTime };

const trak2New = buildAudioTrak(input, audio1.box, a1.stbl, stbl1, {
  trackId: newTrackId,
  tkhdDuration: editDuration,
  elst: track2Elst,
  mdhdDuration: editDurationTicks, // reference: 958848 = edit duration in media ticks
  sttsEntries: track2Stts,
  stscEntries: track2Stsc,
  stszSizes: track2Sizes,
  stcoOffsets: sharedChunkOffsets.concat([0]), // filler offset placeholder
  ctts: startMode === 'ctts' ? { count: track2SampleCount, offset: mediaTime } : null,
});

let udtaSize = 0;
readBoxes(input, moov.content, moov.end, (box) => {
  if (box.type === 'udta') udtaSize = box.size;
});
const mvhdGrowth = mvhdV1Unknown ? 120 - mvhdBox.size : 0;
const moovDelta = trak1New.buffer.length - (audio1.box.end - audio1.box.start)
  + trak2New.buffer.length + mvhdGrowth - (dropUdta ? udtaSize : 0);

// ---------------------------------------------------------------------------
// Resolve real chunk offsets now that the layout shift is known
// ---------------------------------------------------------------------------

const shiftedShared = sharedChunkOffsets.map((o) => o + moovDelta);
patchStco(trak1New.buffer, trak1New.stco, shiftedShared);

let fillerOffset;
if (fillerLayout === 'eof') {
  fillerOffset = input.length + moovDelta; // after every existing byte
} else {
  if (lastBox.type !== 'mdat') throw new Error('filler-layout mdat requires mdat as the last box.');
  fillerOffset = lastBox.end + moovDelta;
}
if (fillerOffset + fillerBytes.length > 0xffffffff && trak1New.stco.width === 4) {
  throw new Error('Filler data does not fit in 32-bit chunk offsets.');
}
patchStco(trak2New.buffer, trak2New.stco, shiftedShared.concat([fillerOffset]));

// ---------------------------------------------------------------------------
// Assemble the new moov
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
          out.writeUInt32BE(u32(input.readUInt32BE(at) + moovDelta, 'stco offset'), local(at));
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
      if (['trak', 'mdia', 'minf', 'stbl', 'edts'].includes(child.type)) scan(child.content, child.end);
    });
  }
  scan(box.content, box.end);
  return out;
}

const moovParts = [];
readBoxes(input, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') {
    if (mvhdV1Unknown) {
      moovParts.push(buildMvhdV1Unknown(movieTimescale, newTrackId + 1));
      return;
    }
    const mv = Buffer.from(input.subarray(box.start, box.end));
    mv.writeUInt32BE(u32(newTrackId + 1, 'next track id'), mvhdNextTrackIdOffset - box.start);
    moovParts.push(mv);
    return;
  }

  if (box.type === 'udta' && dropUdta) return; // removes the creation_time tag
  if (box.type === 'trak') {
    if (box.start === audio1.box.start) {
      moovParts.push(trak1New.buffer);
      moovParts.push(trak2New.buffer);
      return;
    }
    moovParts.push(patchOffsetsInCopy(box));
    return;
  }
  moovParts.push(Buffer.from(input.subarray(box.start, box.end)));
});

const newMoov = makeBox('moov', concat(moovParts));
if (newMoov.length !== moov.size + moovDelta) {
  throw new Error(`Moov size check failed: expected ${moov.size + moovDelta}, built ${newMoov.length}.`);
}

// ---------------------------------------------------------------------------
// Assemble the output file
// ---------------------------------------------------------------------------

const finalOutputBytes = inputStat.size + moovDelta + fillerBytes.length;
if (fillerLayout === 'eof') {
  // Reference behaviour: filler bytes appended past the declared mdat, mdat
  // size field untouched. Demuxers reach them through the chunk offsets.
  // Stream directly to disk to avoid allocating a full duplicate video buffer in RAM:
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(outputPath);
    ws.on('error', reject);
    ws.on('finish', resolve);
    ws.write(input.subarray(0, moov.start));
    ws.write(newMoov);
    const rs = createReadStream(inputPath, { start: moov.end });
    rs.on('error', reject);
    rs.pipe(ws, { end: false });
    rs.on('end', () => {
      ws.end(fillerBytes);
    });
  });
} else {
  const output = concat([
    input.subarray(0, moov.start),
    newMoov,
    input.subarray(moov.end),
    fillerBytes,
  ]);
  const sizeFieldAt = lastBox.start + moovDelta;
  if (lastBox.header === 8) {
    output.writeUInt32BE(u32(lastBox.size + fillerBytes.length, 'mdat size'), sizeFieldAt);
  } else {
    output.writeBigUInt64BE(BigInt(lastBox.size + fillerBytes.length), sizeFieldAt + 8);
  }
  await writeFile(outputPath, output);
}

const fmtEntries = (entries) => entries.map((e) => `${e.count}x${e.duration}`).join(', ');

console.log(JSON.stringify({
  inputBytes: inputStat.size,
  outputBytes: finalOutputBytes,
  sizeGrowth: finalOutputBytes - inputStat.size,
  speedFactor,
  audioTimescale: mdhd.timescale,
  movieTimescale,
  startMode,
  fillerLayout,
  track1: {
    trackId: tkhd.trackId,
    sampleCount: keptCount,
    droppedSamples,
    sttsBefore: fmtEntries(sttsBefore),
    sttsAfter: fmtEntries(sttsTrimmed),
    mediaDurationBefore: sttsBefore.reduce((a, e) => a + e.count * e.duration, 0),
    mediaDurationAfter: mediaTotalAfter,
    mdhdDuration: mediaTotalAfter,
    elst: { duration: editDuration, mediaTime: mediaTime },
    chunkCount: track1ChunkCount,
    stsc: stscShared.map((e) => `${e.firstChunk}:${e.samplesPerChunk}`).join(', '),
  },
  track2: {
    trackId: newTrackId,
    sampleCount: track2SampleCount,
    stts: fmtEntries(track2Stts),
    sttsSum: track2SttsSum,
    mdhdDuration: editDurationTicks,
    elst: track2Elst,
    ctts: startMode === 'ctts' ? { count: track2SampleCount, offset: mediaTime } : null,
    stsc: track2Stsc.map((e) => `${e.firstChunk}:${e.samplesPerChunk}`).join(', '),
    stcoCount: track1ChunkCount + 1,
    sharedChunkOffsets: true,
    fillerCount,
    fillerDuration,
    fillerHex,
    fillerOffset,
  },
  moovDelta,
  nextTrackId: newTrackId + 1,
  mvhdV1Unknown,
  dropUdta,
  notes: [
    'Track 1 elst values are trusted from the input (RTXFury targets 19976/4224).',
    'Final sample trimmed so media ends exactly at the edit end (media_time + edit duration in ticks).',
    'Track 2 shares track 1 chunk offsets; no audio payload bytes are duplicated.',
    'Filler bytes appended at EOF outside the declared mdat (reference behaviour) when fillerLayout=eof.',
    'sgpd/sbgp are kept on both tracks.',
  ],
}, null, 2));
