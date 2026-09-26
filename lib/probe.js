/**
 * Minimal MP4/MOV probe — no dependencies, runs in the browser.
 *
 * v2 — fixes vs v1:
 *   - tkhd field offsets were 4 bytes short (produced nonsense like 2160x16384)
 *   - boxes from the AUDIO track were overwriting video values (wrong fps)
 *   - tracks are now parsed in isolation and selected by hdlr == 'vide'
 *   - colr/hvcC/dvcC are scoped to the video track's sample entry
 *   - exposes _debug so a mis-read can be diagnosed from a real file
 */

const BE = {
  u8:  (d, o) => d.getUint8(o),
  u16: (d, o) => d.getUint16(o),
  u32: (d, o) => d.getUint32(o),
  u64: (d, o) => Number(d.getBigUint64(o)),
  str: (d, o, n) => String.fromCharCode(...new Uint8Array(d.buffer, d.byteOffset + o, n)),
};

const PRIMARIES = { 1:'bt709', 4:'bt470m', 5:'bt470bg', 6:'smpte170m', 7:'smpte240m',
                    9:'bt2020', 11:'smpte431', 12:'smpte432' };
const TRANSFER  = { 1:'bt709', 4:'gamma22', 6:'smpte170m', 7:'smpte240m', 8:'linear',
                    13:'srgb', 14:'bt2020-10', 15:'bt2020-12', 16:'smpte2084',
                    17:'smpte428', 18:'arib-std-b67' };
const MATRIX    = { 0:'gbr', 1:'bt709', 6:'smpte170m', 7:'smpte240m', 9:'bt2020nc',
                    10:'bt2020c', 14:'ictcp' };

const VIDEO_ENTRIES = ['avc1','avc3','hvc1','hev1','dvh1','dvhe','av01','vp09','mp4v'];
const AUDIO_ENTRIES = ['mp4a','alac','Opus','ac-3','ec-3','fLaC'];
const CODEC_NAME = { avc1:'h264', avc3:'h264', hvc1:'hevc', hev1:'hevc',
                     dvh1:'hevc/dv', dvhe:'hevc/dv', av01:'av1', vp09:'vp9', mp4v:'mpeg4' };

function walk(view, start, end, cb) {
  let o = start;
  while (o + 8 <= end) {
    let size = BE.u32(view, o);
    const type = BE.str(view, o + 4, 4);
    let header = 8;
    if (size === 1) {
      if (o + 16 > end) break;
      size = BE.u64(view, o + 8); header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header || o + size > end) break;
    cb(type, o + header, o + size);
    o += size;
  }
}

/** tkhd — the box v1 got wrong.
 *  content: version+flags(4)
 *           v0: create(4) mod(4) trackID(4) rsv(4) duration(4)   = 20  -> +24
 *           v1: create(8) mod(8) trackID(4) rsv(4) duration(8)   = 32  -> +36
 *           rsv[2](8) layer(2) altGroup(2) volume(2) rsv(2)      = 16
 *           matrix[9](36)  width(4 as 16.16)  height(4 as 16.16)
 */
function parseTkhd(d, s) {
  const ver = BE.u8(d, s);
  const afterTimes = s + 4 + (ver === 1 ? 32 : 20);
  const matrix = afterTimes + 16;
  const a = BE.u32(d, matrix) >>> 16;
  const b = BE.u32(d, matrix + 4) >>> 16;
  const c = BE.u32(d, matrix + 12) >>> 16;
  const e = BE.u32(d, matrix + 16) >>> 16;
  const width  = BE.u32(d, matrix + 36) / 65536;
  const height = BE.u32(d, matrix + 40) / 65536;

  let rotation = 0;
  const s16 = v => (v & 0x8000) ? v - 0x10000 : v;
  const A = s16(a), B = s16(b), C = s16(c), E = s16(e);
  if (A === 0 && B === 1 && C === -1 && E === 0) rotation = 90;
  else if (A === -1 && E === -1) rotation = 180;
  else if (A === 0 && B === -1 && C === 1 && E === 0) rotation = 270;

  return { width: Math.round(width), height: Math.round(height), rotation };
}

function parseMdhd(d, s) {
  const ver = BE.u8(d, s);
  return ver === 1
    ? { timescale: BE.u32(d, s + 20), duration: BE.u64(d, s + 24) }
    : { timescale: BE.u32(d, s + 12), duration: BE.u32(d, s + 16) };
}

function parseStts(d, s, e) {
  const count = BE.u32(d, s + 4);
  let frames = 0, total = 0;
  const deltas = new Map();
  for (let i = 0; i < count; i++) {
    const off = s + 8 + i * 8;
    if (off + 8 > e) break;
    const n = BE.u32(d, off), dt = BE.u32(d, off + 4);
    frames += n; total += n * dt;
    deltas.set(dt, (deltas.get(dt) || 0) + n);
  }
  return { frames, total, deltas, entryCount: count };
}

export async function probeFile(file, opts = {}) {
  const CH = 4 * 1024 * 1024;
  const head = new DataView(await file.slice(0, Math.min(file.size, CH)).arrayBuffer());

  const out = {
    fileName: file.name,
    fileSizeMB: +(file.size / 1048576).toFixed(1),
    container: null, brand: null, moovAtEnd: true,
    width: 0, height: 0, rotation: 0,
    codec: null, bitDepth: 8,
    fps: null, vfr: false, frameCount: 0, durationSec: 0,
    colorPrimaries: null, colorTransfer: null, colorMatrix: null, colorRange: 'limited',
    hasDolbyVisionRPU: false, dvProfile: null, dvLevel: null,
    hasEditList: false, isQuickTime: false,
    hasHdr10Metadata: false, maxCLL: null,
    bitrateMbps: null, audioCodec: null,
    _debug: { boxes: [], tracks: [], warnings: [] },
  };

  function readMoov(d, s, e) {
    walk(d, s, e, (t, bs, be) => {
      out._debug.boxes.push(t);
      if (t === 'trak') readTrak(d, bs, be);
      else if (t === 'mvhd') { /* movie header - not needed */ }
    });
  }

  function readTrak(d, s, e) {
    const trk = { kind: null, tkhd: null, mdhd: null, stts: null,
                  codec: null, bitDepth: null, color: null, dv: null, hdr10: null };

    const descend = (bs, be) => walk(d, bs, be, (t, s2, e2) => {
      switch (t) {
        case 'tkhd': trk.tkhd = parseTkhd(d, s2); break;
        case 'mdhd': trk.mdhd = parseMdhd(d, s2); break;
        case 'hdlr': trk.kind = BE.str(d, s2 + 8, 4); break;   // 'vide' | 'soun'
        case 'edts': out.hasEditList = true; break;
        case 'stts': trk.stts = parseStts(d, s2, e2); break;
        case 'stsd': readStsd(d, s2 + 8, e2, trk); break;
        case 'mdia': case 'minf': case 'stbl': descend(s2, e2); break;
      }
    });
    descend(s, e);

    out._debug.tracks.push({
      kind: trk.kind,
      dims: trk.tkhd ? `${trk.tkhd.width}x${trk.tkhd.height}` : null,
      rotation: trk.tkhd?.rotation ?? null,
      timescale: trk.mdhd?.timescale ?? null,
      sttsEntries: trk.stts?.entryCount ?? null,
      frames: trk.stts?.frames ?? null,
      codec: trk.codec,
    });

    if (trk.kind === 'soun') { if (trk.codec) out.audioCodec = trk.codec; return; }
    if (trk.kind !== 'vide' && !trk.codec) return;
    // Ignore a second video track (e.g. a thumbnail) once we have one.
    if (out.codec && out.width) return;

    if (trk.tkhd && trk.tkhd.width > 0) {
      out.width = trk.tkhd.width; out.height = trk.tkhd.height;
      out.rotation = trk.tkhd.rotation;
    }
    if (trk.codec) out.codec = trk.codec;
    if (trk.bitDepth) out.bitDepth = trk.bitDepth;
    if (trk.color) Object.assign(out, trk.color);
    if (trk.dv) { out.hasDolbyVisionRPU = true; out.dvProfile = trk.dv.profile; out.dvLevel = trk.dv.level; }
    if (trk.hdr10) { out.hasHdr10Metadata = true; out.maxCLL = trk.hdr10.maxCLL; }

    if (trk.mdhd?.timescale && trk.stts?.frames) {
      const { timescale } = trk.mdhd;
      const { frames, total, deltas } = trk.stts;
      out.frameCount = frames;
      out.durationSec = +(total / timescale).toFixed(3);
      out.fps = +((frames * timescale) / total).toFixed(3);
      // Real VFR = more than one delta accounting for a meaningful share of
      // frames. A single odd final sample is normal even in CFR files.
      const sorted = [...deltas.entries()].sort((a, b) => b[1] - a[1]);
      const dominant = sorted[0]?.[1] ?? 0;
      out.vfr = deltas.size > 1 && (dominant / frames) < 0.98;
      if (!out.vfr && sorted[0]) {
        // Snap to the dominant cadence — the true export frame rate.
        out.fps = +(timescale / sorted[0][0]).toFixed(3);
      }
      out._debug.tracks.at(-1).deltas = sorted.slice(0, 4).map(([d2, n]) => `${d2}×${n}`);
    }
  }

  function readStsd(d, s, e, trk) {
    walk(d, s, e, (t, s2, e2) => {
      if (VIDEO_ENTRIES.includes(t)) {
        trk.codec = CODEC_NAME[t] || t;
        if (t.startsWith('dv')) trk.dv = { profile: 8.4, level: null };
        walk(d, s2 + 78, e2, (t3, s3, e3) => readVisualChild(d, t3, s3, e3, trk));
      } else if (AUDIO_ENTRIES.includes(t)) {
        trk.codec = t === 'mp4a' ? 'aac' : t.toLowerCase();
      }
    });
  }

  function readVisualChild(d, t, s, e, trk) {
    switch (t) {
      case 'colr': {
        const kind = BE.str(d, s, 4);
        if (kind === 'nclx' || kind === 'nclc') {
          const p = BE.u16(d, s + 4), tr = BE.u16(d, s + 6), m = BE.u16(d, s + 8);
          trk.color = {
            colorPrimaries: PRIMARIES[p] ?? `unknown(${p})`,
            colorTransfer:  TRANSFER[tr] ?? `unknown(${tr})`,
            colorMatrix:    MATRIX[m] ?? `unknown(${m})`,
            colorRange: (kind === 'nclx' && (BE.u8(d, s + 10) & 0x80)) ? 'full' : 'limited',
          };
        }
        break;
      }
      case 'dvcC': case 'dvvC': case 'dvwC': {
        const b2 = BE.u8(d, s + 2), b3 = BE.u8(d, s + 3);
        const profile = (b2 >> 1) & 0x7F;
        const level = ((b2 & 1) << 5) | ((b3 >> 3) & 0x1F);
        // profile 8 + BL signal cross-compat -> 8.4 in common usage
        trk.dv = { profile: profile === 8 ? 8.4 : profile, level };
        break;
      }
      case 'hvcC': {
        // HEVCDecoderConfigurationRecord:
        //   16: reserved(6) + chromaFormatIdc(2)
        //   17: reserved(5) + bitDepthLumaMinus8(3)   <-- here
        //   18: reserved(5) + bitDepthChromaMinus8(3)
        if (e - s >= 18) {
          const bd = (BE.u8(d, s + 17) & 0x07) + 8;
          if (bd === 8 || bd === 10 || bd === 12) trk.bitDepth = bd;
        }
        break;
      }
      case 'av1C': {
        if (e - s >= 2) {
          const b = BE.u8(d, s + 1);
          trk.bitDepth = ((b >> 5) & 1) ? (((b >> 4) & 1) ? 12 : 10) : 8;
        }
        break;
      }
      case 'mdcv': trk.hdr10 = { ...(trk.hdr10 || {}), mastering: true }; break;
      case 'clli': trk.hdr10 = { ...(trk.hdr10 || {}), maxCLL: BE.u16(d, s) }; break;
      case 'btrt': break;
    }
  }

  // --- locate moov ---------------------------------------------------------
  let found = false;
  let moovPos = -1, mdatPos = -1;
  walk(head, 0, head.byteLength, (t, s, e) => {
    if (t === 'ftyp') {
      out.brand = BE.str(head, s, 4);
      out.isQuickTime = /qt/i.test(out.brand);
      out.container = out.isQuickTime ? 'mov' : 'mp4';
    }
    if (t === 'mdat' && mdatPos < 0) mdatPos = s;
    if (t === 'moov') { moovPos = s; found = true; readMoov(head, s, e); }
  });
  // faststart = moov physically precedes the media payload
  if (moovPos >= 0) out.moovAtEnd = (mdatPos >= 0 && moovPos > mdatPos);

  if (!found) {
    // Tail scan — moov at the end (no faststart)
    const tailLen = Math.min(file.size, 8 * 1024 * 1024);
    const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    walk(tail, 0, tail.byteLength, (t, s, e) => {
      if (t === 'moov') { found = true; readMoov(tail, s, e); }
    });
    if (!found) {
      // brute scan for the 'moov' signature
      const u8 = new Uint8Array(tail.buffer);
      for (let i = 0; i < u8.length - 8; i++) {
        if (u8[i] === 0x6d && u8[i+1] === 0x6f && u8[i+2] === 0x6f && u8[i+3] === 0x76) {
          const boxStart = i - 4;
          if (boxStart < 0) continue;
          const size = BE.u32(tail, boxStart);
          if (size > 8 && boxStart + size <= tail.byteLength) {
            readMoov(tail, boxStart + 8, boxStart + size); found = true; break;
          }
        }
      }
    }
    if (!found) out._debug.warnings.push('moov box not found — file may be fragmented or truncated');
  }

  if (out.durationSec > 0) out.bitrateMbps = +((file.size * 8) / out.durationSec / 1e6).toFixed(1);

  if (out.rotation === 90 || out.rotation === 270) {
    [out.width, out.height] = [out.height, out.width];
  }

  out.hdr = out.colorTransfer === 'smpte2084' || out.colorTransfer === 'arib-std-b67'
            || out.colorPrimaries === 'bt2020' || out.hasDolbyVisionRPU;
  out.hdrFormat = out.hasDolbyVisionRPU ? 'dolbyvision'
    : out.colorTransfer === 'smpte2084' ? (out.hasHdr10Metadata ? 'hdr10' : 'pq')
    : out.colorTransfer === 'arib-std-b67' ? 'hlg' : null;

  if (!out.colorTransfer) out._debug.warnings.push('no colr box — colour is untagged in this file');
  if (!out.fps) out._debug.warnings.push('no stts timing found — frame rate unknown');

  return out;
}
