import { open } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { scanTopLevelBoxes } from './stream-scanner.js';
import { stripDolbyVision, rebrandToMp4, isoTimescale, neutraliseEditLists } from './remux.js';

const BE = {
  u32: (v, o) => v.getUint32(o),
  u64: (v, o) => Number(v.getBigUint64(o)),
};

function findOffsetTables(view, start, end, acc = []) {
  let o = start;
  while (o + 8 <= end) {
    const size = view.getUint32(o);
    const type = String.fromCharCode(
      view.getUint8(o + 4), view.getUint8(o + 5),
      view.getUint8(o + 6), view.getUint8(o + 7),
    );
    if (size < 8 || o + size > end) break;
    const bodyStart = o + 8;
    const bodyEnd = o + size;

    if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl') {
      findOffsetTables(view, bodyStart, bodyEnd, acc);
    } else if (type === 'stco') {
      const count = view.getUint32(bodyStart + 4);
      acc.push({ type: 'stco', count, entriesAt: bodyStart + 8, boxEnd: bodyEnd });
    } else if (type === 'co64') {
      const count = view.getUint32(bodyStart + 4);
      acc.push({ type: 'co64', count, entriesAt: bodyStart + 8, boxEnd: bodyEnd });
    }
    o += size;
  }
  return acc;
}

export async function streamFaststartRemux(inputPath, outputPath, opts = {}) {
  const fh = await open(inputPath, 'r');
  const stat = await fh.stat();
  const boxes = await scanTopLevelBoxes(fh, stat.size);

  const moov = boxes.find(b => b.type === 'moov');
  const mdats = boxes.filter(b => b.type === 'mdat');
  if (!moov) { await fh.close(); throw new Error('No moov atom found.'); }
  if (!mdats.length) { await fh.close(); throw new Error('No mdat atom found.'); }

  const firstMdat = mdats[0];
  const isAlreadyFaststart = moov.start < firstMdat.start;

  const ftyp = boxes.find(b => b.type === 'ftyp');
  const rest = boxes.filter(b => b !== moov && b !== ftyp);

  // Read ftyp and moov only
  const ftypBuf = ftyp ? Buffer.alloc(ftyp.size) : null;
  if (ftyp) await fh.read(ftypBuf, 0, ftyp.size, ftyp.start);

  const moovBuf = Buffer.alloc(moov.size);
  await fh.read(moovBuf, 0, moov.size, moov.start);
  const moovView = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);

  let patched = 0;
  let totalSize = stat.size;

  if (!isAlreadyFaststart) {
    // New layout: ftyp -> moov -> rest
    const segments = [];
    let cursor = 0;
    if (ftyp) { segments.push({ ...ftyp, newStart: cursor }); cursor += ftyp.size; }
    const moovNewStart = cursor; cursor += moov.size;
    for (const b of rest) { segments.push({ ...b, newStart: cursor }); cursor += b.size; }
    totalSize = cursor;

    // Remap chunk offsets in moov
    const tables = findOffsetTables(moovView, 8, moovBuf.length);
    const remap = (oldOff) => {
      for (const s of segments) {
        if (oldOff >= s.start && oldOff < s.end) return oldOff + (s.newStart - s.start);
      }
      return null;
    };

    for (const t of tables) {
      const stride = t.type === 'co64' ? 8 : 4;
      for (let i = 0; i < t.count; i++) {
        const at = t.entriesAt + i * stride;
        const oldOff = t.type === 'co64' ? BE.u64(moovView, at) : BE.u32(moovView, at);
        const newOff = remap(oldOff);
        if (newOff === null) throw new Error('Offset outside kept boxes.');
        if (t.type === 'co64') moovView.setBigUint64(at, BigInt(newOff));
        else moovView.setUint32(at, newOff);
        patched++;
      }
    }
  }

  // Box-level modifications (Dolby Vision, TikTok signature, rebranding)
  let dvStripped = null;
  let isoSigned = null;
  let rebranded = 0;

  if (opts.stripDV) {
    dvStripped = stripDolbyVision(moovView, 8, moovBuf.length);
  }
  if (opts.isoSignature) {
    isoSigned = isoTimescale(moovView, 8, moovBuf.length);
  }
  if (opts.rebrand && ftypBuf) {
    const ftypView = new DataView(ftypBuf.buffer, ftypBuf.byteOffset, ftypBuf.byteLength);
    rebranded = rebrandToMp4(ftypView, [{ type: 'ftyp', start: 0, end: ftypBuf.length }]);
  }

  // Write streamed output
  const ws = createWriteStream(outputPath);
  if (ftypBuf) ws.write(ftypBuf);
  ws.write(moovBuf);

  // Stream media payload (rest / mdat)
  for (const b of rest) {
    await new Promise((resolve, reject) => {
      const rs = createReadStream(inputPath, { start: b.start, end: b.end - 1 });
      rs.on('error', reject);
      rs.on('end', resolve);
      rs.pipe(ws, { end: false });
    });
  }

  await new Promise((resolve, reject) => {
    ws.on('error', reject);
    ws.end(resolve);
  });
  await fh.close();

  return {
    totalSize,
    patchedMoov: moovBuf,
    dvStripped,
    rebranded,
    isoSigned,
    patched,
  };
}
