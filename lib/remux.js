/**
 * Lossless MP4 faststart remux.
 *
 * Moves the `moov` atom in front of `mdat` so uploaders can parse the file
 * immediately. The encoded video samples are copied BYTE FOR BYTE — nothing is
 * decoded and nothing is re-encoded, so Dolby Vision RPU, HLG/PQ transfer,
 * 10-bit depth, frame timing and bitrate are all preserved exactly.
 *
 * The only work is rewriting chunk offsets (`stco` / `co64`), because those
 * are absolute file positions and everything shifts when moov moves.
 */

const BE = {
  u32: (d, o) => d.getUint32(o),
  u64: (d, o) => Number(d.getBigUint64(o)),
  str: (d, o, n) => String.fromCharCode(...new Uint8Array(d.buffer, d.byteOffset + o, n)),
};

function topLevelBoxes(view) {
  const out = [];
  let o = 0;
  while (o + 8 <= view.byteLength) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) { size = BE.u64(view, o + 8); header = 16; }
    else if (size === 0) { size = view.byteLength - o; }
    if (size < header || o + size > view.byteLength) break;
    out.push({ type, start: o, end: o + size, size });
    o += size;
  }
  return out;
}

/** Recursively collect every stco/co64 table inside a moov buffer. */
function findOffsetTables(view, start, end, acc = []) {
  let o = start;
  const CONTAINERS = new Set(['moov','trak','mdia','minf','stbl','edts','udta','mvex']);
  while (o + 8 <= end) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) { size = BE.u64(view, o + 8); header = 16; }
    else if (size === 0) { size = end - o; }
    if (size < header || o + size > end) break;

    if (type === 'stco' || type === 'co64') {
      const base = o + header + 4;             // skip version+flags
      acc.push({ type, countAt: base, entriesAt: base + 4, count: BE.u32(view, base) });
    } else if (CONTAINERS.has(type)) {
      findOffsetTables(view, o + header, o + size, acc);
    }
    o += size;
  }
  return acc;
}

/**
 * Zero the duration fields in mvhd / tkhd / mdhd.
 *
 * WHY: server ingest pipelines commonly derive an input bitrate as
 * filesize / duration to pick a rung on their transcode ladder. A zero
 * duration makes that computation meaningless, and in practice TikTok appears
 * to fall back to a lighter-touch path.
 *
 * This is exploiting a bug, not using a feature. See the risk notes in
 * BYPASS-ANALYSIS.md before enabling it by default.
 *
 * Side effect: players show "0 seconds". That is expected and is exactly what
 * competing tools warn their users about.
 */
function zeroDurations(view, start, end, stats = { mvhd:0, tkhd:0, mdhd:0 }) {
  const CONTAINERS = new Set(['moov','trak','mdia','edts']);
  let o = start;
  while (o + 8 <= end) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) { size = BE.u64(view, o + 8); header = 16; }
    else if (size === 0) { size = end - o; }
    if (size < header || o + size > end) break;

    const c = o + header;                    // content start
    const ver = view.getUint8(c);

    if (type === 'mvhd') {
      // v0: create(4) mod(4) timescale(4) duration(4)
      // v1: create(8) mod(8) timescale(4) duration(8)
      if (ver === 1) view.setBigUint64(c + 4 + 20, 0n);
      else           view.setUint32(c + 4 + 12, 0);
      stats.mvhd++;
    } else if (type === 'tkhd') {
      // v0: create(4) mod(4) trackID(4) rsv(4) duration(4)
      // v1: create(8) mod(8) trackID(4) rsv(4) duration(8)
      if (ver === 1) view.setBigUint64(c + 4 + 24, 0n);
      else           view.setUint32(c + 4 + 16, 0);
      stats.tkhd++;
    } else if (type === 'mdhd') {
      if (ver === 1) view.setBigUint64(c + 4 + 20, 0n);
      else           view.setUint32(c + 4 + 12, 0);
      stats.mdhd++;
    } else if (CONTAINERS.has(type)) {
      zeroDurations(view, c, o + size, stats);
    }
    o += size;
  }
  return stats;
}

/**
 * @param {File|Blob} file
 * @param {(pct:number, label:string)=>void} [onProgress]
 * @param {{zeroDuration?:boolean}} [opts]
 * @returns {Promise<{blob:Blob, moved:boolean, patched:number, note:string, durationZeroed?:object}>}
 */
export async function faststartRemux(file, onProgress = () => {}, opts = {}) {
  onProgress(5, 'Reading container');
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);

  const boxes = topLevelBoxes(view);
  if (!boxes.length) throw new Error('Not a valid MP4/MOV container.');

  const moov = boxes.find(b => b.type === 'moov');
  const mdats = boxes.filter(b => b.type === 'mdat');
  if (!moov) throw new Error('No moov atom found — file may be fragmented or truncated.');
  if (!mdats.length) throw new Error('No mdat atom found.');

  const firstMdat = mdats[0];
  if (moov.start < firstMdat.start) {
    // Already faststart. If a duration patch was requested we still have work
    // to do — rebuild the file with a patched moov instead of bailing out.
    if (!opts.zeroDuration) {
      return { blob: file, moved: false, patched: 0,
               note: 'moov is already at the front — nothing to change.' };
    }
    onProgress(40, 'Applying duration patch');
    const mv = new Uint8Array(buf.slice(moov.start, moov.end));
    const stats = zeroDurations(new DataView(mv.buffer), 8, mv.length);
    const parts = [];
    for (const b of boxes) {
      parts.push(b === moov ? mv : buf.slice(b.start, b.end));
    }
    onProgress(100, 'Done');
    return {
      blob: new Blob(parts, { type: 'video/mp4' }),
      moved: false, patched: 0, durationZeroed: stats,
      note: `Already faststart. Duration zeroed in ${stats.mvhd} mvhd / ` +
            `${stats.tkhd} tkhd / ${stats.mdhd} mdhd — players will show 0:00, ` +
            `which is expected. Video and audio copied byte-for-byte.`,
    };
  }

  onProgress(20, 'Planning new layout');

  // New order: ftyp (if present) → moov → everything else, original order.
  const ftyp = boxes.find(b => b.type === 'ftyp');
  const rest = boxes.filter(b => b !== moov && b !== ftyp);

  // Map every retained byte range to its new position.
  const segments = [];
  let cursor = 0;
  if (ftyp) { segments.push({ ...ftyp, newStart: cursor }); cursor += ftyp.size; }
  const moovNewStart = cursor; cursor += moov.size;
  for (const b of rest) { segments.push({ ...b, newStart: cursor }); cursor += b.size; }
  const totalSize = cursor;

  // Copy moov so we can patch it without touching the source buffer.
  const moovBytes = new Uint8Array(buf.slice(moov.start, moov.end));
  const moovView = new DataView(moovBytes.buffer);

  onProgress(45, 'Rewriting chunk offsets');

  const tables = findOffsetTables(moovView, 8, moovBytes.length);
  let patched = 0, needs64 = false;

  const remap = (oldOff) => {
    for (const s of segments) {
      if (oldOff >= s.start && oldOff < s.end) return oldOff + (s.newStart - s.start);
    }
    return null; // offset points at the old moov or outside any kept box
  };

  for (const t of tables) {
    const stride = t.type === 'co64' ? 8 : 4;
    for (let i = 0; i < t.count; i++) {
      const at = t.entriesAt + i * stride;
      if (at + stride > moovBytes.length) throw new Error('Corrupt offset table.');
      const oldOff = t.type === 'co64' ? BE.u64(moovView, at) : BE.u32(moovView, at);
      const newOff = remap(oldOff);
      if (newOff === null) {
        throw new Error('A chunk offset points outside the media data — cannot safely remux.');
      }
      if (t.type === 'stco' && newOff > 0xFFFFFFFF) { needs64 = true; break; }
      if (t.type === 'co64') moovView.setBigUint64(at, BigInt(newOff));
      else moovView.setUint32(at, newOff);
      patched++;
    }
    if (needs64) break;
  }

  if (needs64) {
    throw new Error('File is over 4 GB and uses 32-bit offsets — needs co64 promotion (not supported yet).');
  }

  let durationZeroed = null;
  if (opts.zeroDuration) {
    onProgress(60, 'Applying duration patch');
    durationZeroed = zeroDurations(moovView, 8, moovBytes.length);
  }

  onProgress(70, 'Assembling file');

  // Assemble without duplicating the media payload in memory more than once.
  const parts = [];
  if (ftyp) parts.push(buf.slice(ftyp.start, ftyp.end));
  parts.push(moovBytes);
  for (const b of rest) parts.push(buf.slice(b.start, b.end));

  const blob = new Blob(parts, { type: 'video/mp4' });
  onProgress(100, 'Done');

  if (blob.size !== totalSize) {
    throw new Error(`Size mismatch: expected ${totalSize}, built ${blob.size}.`);
  }

  return {
    blob, moved: true, patched, durationZeroed,
    note: `moov moved to the front, ${patched} chunk offsets rewritten. ` +
          `Video and audio data copied byte-for-byte — no quality change.` +
          (durationZeroed
            ? ` Duration zeroed in ${durationZeroed.mvhd} mvhd / ${durationZeroed.tkhd} tkhd / ${durationZeroed.mdhd} mdhd — players will show 0:00, which is expected.`
            : ''),
  };
}
