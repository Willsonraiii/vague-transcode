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
 * Strip Dolby Vision signalling, keeping the HLG/PQ base layer.
 *
 * Profile 8.4 is an HLG base layer plus an RPU. The HDR lives in the base
 * layer — the RPU only carries dynamic metadata. Platforms and players that
 * mishandle the RPU can render worse than if it were absent, and a plain HLG
 * file is simply labelled "HDR", which is handled correctly everywhere.
 *
 * We rename the `dvcC`/`dvvC`/`dvwC` configuration boxes to `free` (same
 * length, so no offsets move) and retag `dvh1`/`dvhe` sample entries as
 * `hvc1`/`hev1`. Without the config box nothing reads the RPU NALs, so the
 * file presents as ordinary HEVC HDR.
 *
 * The picture data is not touched — this is still lossless.
 */
function eachBox(view, start, end, cb) {
  let o = start;
  while (o + 8 <= end) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) { size = BE.u64(view, o + 8); header = 16; }
    else if (size === 0) { size = end - o; }
    if (size < header || o + size > end) break;
    cb(type, o, o + header, o + size);
    o += size;
  }
}

function stripDolbyVision(view, start, end, stats = { boxes: 0, retagged: 0 }) {
  const CONTAINERS = new Set(['moov','trak','mdia','minf','stbl']);
  const RETAG = { dvh1: 'hvc1', dvhe: 'hev1' };
  let o = start;
  while (o + 8 <= end) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) { size = BE.u64(view, o + 8); header = 16; }
    else if (size === 0) { size = end - o; }
    if (size < header || o + size > end) break;

    const write4 = (off, str) => { for (let i = 0; i < 4; i++) view.setUint8(off + i, str.charCodeAt(i)); };

    if (type === 'dvcC' || type === 'dvvC' || type === 'dvwC') {
      write4(o + 4, 'free');
      stats.boxes++;
    } else if (RETAG[type]) {
      write4(o + 4, RETAG[type]);
      stats.retagged++;
      walkSampleEntry(view, o + header + 78, o + size, stats);
    } else if (type === 'stsd') {
      eachBox(view, o + header + 8, o + size, (t2, bStart, cStart, bEnd) => {
        if (['hvc1','hev1','dvh1','dvhe'].includes(t2)) {
          if (RETAG[t2]) { write4(bStart + 4, RETAG[t2]); stats.retagged++; }
          walkSampleEntry(view, cStart + 78, bEnd, stats);
        }
      });
    } else if (CONTAINERS.has(type)) {
      stripDolbyVision(view, o + header, o + size, stats);
    }
    o += size;
  }
  return stats;
}

function walkSampleEntry(view, start, end, stats) {
  eachBox(view, start, end, (t, bStart) => {
    if (t === 'dvcC' || t === 'dvvC' || t === 'dvwC') {
      for (let i = 0; i < 4; i++) view.setUint8(bStart + 4 + i, 'free'.charCodeAt(i));
      stats.boxes++;
    }
  });
}

/**
 * Rebrand a QuickTime file as a standard MP4.
 *
 * iPhone and many cameras write ftyp major_brand = "qt  ". Some ingest
 * pipelines treat QuickTime files differently from MP4. Relabelling costs
 * nothing — the box is the same length, so no offsets move.
 *
 * Returns the number of brands rewritten.
 */
function rebrandToMp4(view, boxes) {
  const ftyp = boxes.find(b => b.type === 'ftyp');
  if (!ftyp) return 0;
  const major = BE.str(view, ftyp.start + 8, 4);
  if (!/qt/i.test(major)) return 0;               // already an MP4 brand
  // major_brand -> "mp42"
  const w = (off, str) => { for (let i = 0; i < 4; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  w(ftyp.start + 8, 'mp42');
  // compatible_brands start at +16; overwrite any "qt  " entries with isom/mp41
  const subs = ['isom', 'mp41', 'iso2', 'avc1'];
  let si = 0;
  for (let o = ftyp.start + 16; o + 4 <= ftyp.end; o += 4) {
    if (/qt/i.test(BE.str(view, o, 4))) w(o, subs[si++ % subs.length]);
  }
  return 1;
}

/**
 * Neutralise edit lists.
 *
 * An `elst` can shift the presentation start, skip leading frames, or express
 * a reorder delay. Players and ingest pipelines honour it inconsistently, and
 * a stray edit list is a common cause of "the first half second is missing" or
 * audio drifting against video.
 *
 * Rather than delete the box (which would move every subsequent offset), we
 * rename its parent `edts` to `free`. Same length, so nothing shifts — readers
 * simply skip it as padding.
 */
function neutraliseEditLists(view, start, end, count = { n: 0 }) {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia']);
  let o = start;
  while (o + 8 <= end) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) { size = BE.u64(view, o + 8); header = 16; }
    else if (size === 0) { size = end - o; }
    if (size < header || o + size > end) break;

    if (type === 'edts') {
      for (let i = 0; i < 4; i++) view.setUint8(o + 4 + i, 'free'.charCodeAt(i));
      count.n++;
    } else if (CONTAINERS.has(type)) {
      neutraliseEditLists(view, o + header, o + size, count);
    }
    o += size;
  }
  return count.n;
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
/**
 * mode:
 *   'safe'       mvhd duration -> 1 tick. Players/galleries round it to 00:00,
 *                but it is a VALID positive duration, so uploaders that check
 *                "does this file contain media" still accept it. Track headers
 *                (tkhd/mdhd) keep their real values, so the media itself is
 *                completely intact.
 *   'zero'       mvhd -> 0. Some uploaders treat 0 as an invalid/empty file.
 *   'aggressive' mvhd + tkhd + mdhd -> 0. Known to make TikTok refuse the
 *                upload outright. Kept only for experimentation.
 */
function zeroDurations(view, start, end, stats = { mvhd:0, tkhd:0, mdhd:0 }, mode = 'safe') {
  const VAL = mode === 'safe' ? 1 : 0;
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
      // Movie header. This is the one players read for the scrub bar, and the
      // only one that needs touching. v0: create(4) mod(4) timescale(4) dur(4)
      //                              v1: create(8) mod(8) timescale(4) dur(8)
      if (ver === 1) view.setBigUint64(c + 4 + 20, BigInt(VAL));
      else           view.setUint32(c + 4 + 12, VAL);
      stats.mvhd++;
      stats.value = VAL;
    } else if (type === 'tkhd' && mode === 'aggressive') {
      if (ver === 1) view.setBigUint64(c + 4 + 24, 0n);
      else           view.setUint32(c + 4 + 16, 0);
      stats.tkhd++;
    } else if (type === 'mdhd' && mode === 'aggressive') {
      // MEDIA header — defines the track's own timeline. Zeroing this has been
      // observed to make TikTok reject the upload outright, because the track
      // then appears to contain no media. Off unless explicitly asked for.
      if (ver === 1) view.setBigUint64(c + 4 + 20, 0n);
      else           view.setUint32(c + 4 + 12, 0);
      stats.mdhd++;
    } else if (CONTAINERS.has(type)) {
      zeroDurations(view, c, o + size, stats, mode);
    }
    o += size;
  }
  return stats;
}

/**
 * The 60/120fps "method" (ut0ku/120fps-method, Zilem-style): divide the
 * timescale AND duration of every mvhd and every mdhd by a divider
 * (2 for 60 fps sources, 4 for 120 fps). Real-time duration (dur/ts) is
 * unchanged, byte widths are unchanged (offsets never move), sample data
 * and stts tables are untouched — but a player or encoder that computes
 * the frame rate from timescale/delta now reads HALF (or a QUARTER of) the
 * true rate. TikTok's re-encoder then finds "30 fps" and has nothing to
 * decimate, so the full sample count survives. Verified in the wild at
 * scale by the method's users; mirrored from the reference C++ patcher.
 */
function timescaleMethod(view, start, end, stats = { mvhd: 0, mdhd: 0 }, divider = 2) {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia']);
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

    if (type === 'mvhd' || type === 'mdhd') {
      // v0: ver+flags(4) create(4) mod(4) ts(4) dur(4)  → ts c+12, dur c+16
      // v1: ver+flags(4) create(8) mod(8) ts(4) dur(8)  → ts c+20, dur c+28
      const tsOff = ver === 1 ? c + 20 : c + 12;
      const durOff = ver === 1 ? c + 28 : c + 16;
      const ts = BE.u32(view, tsOff);
      const nts = Math.max(1, Math.floor(ts / divider));
      if (nts !== ts) {
        view.setUint32(tsOff, nts);
        if (ver === 1) {
          const d = view.getBigUint64(durOff);
          view.setBigUint64(durOff, d / BigInt(divider));
        } else {
          view.setUint32(durOff, Math.floor(BE.u32(view, durOff) / divider));
        }
        stats[type]++;
        stats.divider = divider;
      }
    } else if (CONTAINERS.has(type)) {
      timescaleMethod(view, c, o + size, stats, divider);
    }
    o += size;
  }
  return stats;
}

/**
 * @param {File|Blob} file
 * @param {(pct:number, label:string)=>void} [onProgress]
 * @param {{zeroDuration?:boolean, rebrand?:boolean, stripEdits?:boolean, stripDV?:boolean}} [opts]
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
    const wantsWork = opts.zeroDuration || opts.rebrand || opts.stripEdits || opts.stripDV || opts.fpsGuard;
    if (!wantsWork) {
      return { blob: file, moved: false, patched: 0,
               note: 'moov is already at the front — nothing to change.' };
    }
    onProgress(40, 'Rewriting container metadata');
    const mv = new Uint8Array(buf.slice(moov.start, moov.end));
    const mvView = new DataView(mv.buffer);
    const stats = opts.zeroDuration
      ? zeroDurations(mvView, 8, mv.length, undefined,
                      opts.zeroDuration === 'aggressive' ? 'aggressive' : 'safe')
      : null;
    const edits = opts.stripEdits ? neutraliseEditLists(mvView, 8, mv.length) : 0;
    const dv = opts.stripDV ? stripDolbyVision(mvView, 8, mv.length) : null;
    const guard = opts.fpsGuard ? timescaleMethod(mvView, 8, mv.length, undefined, opts.fpsGuard) : null;

    // ftyp lives outside moov — patch it in a copy of the head
    const headBytes = new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 4096)));
    const headView = new DataView(headBytes.buffer);
    const rebranded = opts.rebrand
      ? rebrandToMp4(headView, boxes.filter(b => b.end <= headBytes.length)) : 0;

    const parts = [];
    for (const b of boxes) {
      if (b === moov) parts.push(mv);
      else if (rebranded && b.type === 'ftyp') parts.push(headBytes.slice(b.start, b.end));
      else parts.push(buf.slice(b.start, b.end));
    }
    onProgress(100, 'Done');
    const did = [];
    if (stats) did.push(`movie-header duration set to ${stats.value === 1 ? '1 tick' : '0'} — shows 00:00 in players` +
      (stats.mdhd ? ' (aggressive: media headers too — may break upload)' : ''));
    if (edits) did.push(`${edits} edit list${edits>1?'s':''} neutralised`);
    if (rebranded) did.push('rebranded QuickTime → MP4');
    if (dv && (dv.boxes || dv.retagged)) did.push(`Dolby Vision signalling removed — now plain HLG HDR`);
    if (guard && (guard.mvhd || guard.mdhd)) did.push(`frame-rate method applied — timescale ÷${guard.divider} in ${guard.mvhd} mvhd + ${guard.mdhd} mdhd`);
    return {
      blob: new Blob(parts, { type: 'video/mp4' }),
      moved: false, patched: 0, durationZeroed: stats, editsStripped: edits, rebranded,
      dvStripped: dv, fpsGuarded: guard,
      note: `Already faststart. ${did.join(' · ')}. Video and audio copied byte-for-byte.`,
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

  let durationZeroed = null, editsStripped = 0, rebranded = 0, dvStripped = null, fpsGuarded = null;
  if (opts.stripEdits) {
    onProgress(55, 'Neutralising edit lists');
    editsStripped = neutraliseEditLists(moovView, 8, moovBytes.length);
  }
  if (opts.stripDV) {
    onProgress(58, 'Removing Dolby Vision signalling');
    dvStripped = stripDolbyVision(moovView, 8, moovBytes.length);
  }
  if (opts.zeroDuration) {
    onProgress(60, 'Applying duration patch');
    durationZeroed = zeroDurations(moovView, 8, moovBytes.length, undefined,
                     opts.zeroDuration === 'aggressive' ? 'aggressive' : 'safe');
  }
  if (opts.fpsGuard) {
    onProgress(62, 'Applying frame-rate method');
    fpsGuarded = timescaleMethod(moovView, 8, moovBytes.length, undefined, opts.fpsGuard);
  }
  let ftypBytes = null;
  if (opts.rebrand && ftyp) {
    const fb = new Uint8Array(buf.slice(ftyp.start, ftyp.end));
    const fv = new DataView(fb.buffer);
    rebranded = rebrandToMp4(fv, [{ type:'ftyp', start:0, end:fb.length }]);
    if (rebranded) ftypBytes = fb;
  }

  onProgress(70, 'Assembling file');

  // Assemble without duplicating the media payload in memory more than once.
  const parts = [];
  if (ftyp) parts.push(ftypBytes || buf.slice(ftyp.start, ftyp.end));
  parts.push(moovBytes);
  for (const b of rest) parts.push(buf.slice(b.start, b.end));

  const blob = new Blob(parts, { type: 'video/mp4' });
  onProgress(100, 'Done');

  if (blob.size !== totalSize) {
    throw new Error(`Size mismatch: expected ${totalSize}, built ${blob.size}.`);
  }

  const extra = [];
  if (editsStripped) extra.push(`${editsStripped} edit list${editsStripped>1?'s':''} neutralised`);
  if (rebranded) extra.push('rebranded QuickTime → MP4');
  if (dvStripped && (dvStripped.boxes || dvStripped.retagged))
    extra.push(`Dolby Vision signalling removed (${dvStripped.boxes} config box${dvStripped.boxes===1?'':'es'}) — now plain HLG HDR`);
  if (durationZeroed) extra.push(`movie-header duration set to ${durationZeroed.value === 1 ? '1 tick' : '0'} — shows 00:00 in players` +
    (durationZeroed.mdhd ? ' (aggressive: media headers too — may break upload)' : ''));
  if (fpsGuarded && (fpsGuarded.mvhd || fpsGuarded.mdhd))
    extra.push(`frame-rate method applied — timescale ÷${fpsGuarded.divider} in ${fpsGuarded.mvhd} mvhd + ${fpsGuarded.mdhd} mdhd (declared fps halved; samples untouched)`);
  return {
    blob, moved: true, patched, durationZeroed, editsStripped, rebranded, dvStripped, fpsGuarded,
    note: `moov moved to the front, ${patched} chunk offsets rewritten` +
          (extra.length ? '. ' + extra.join(' · ') : '') +
          `. Video and audio copied byte-for-byte — no quality change.`,
  };
}
