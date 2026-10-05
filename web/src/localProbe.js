/* Reads the original video's identity right in the browser — nothing leaves the device.
   Walks MP4/MOV boxes (moov/trak/mdhd/stts/stsd/colr/dvcC) the same honest way the
   server does, but locally, instantly, before any upload. */

const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64 = (b, o) => u32(b, o) * 4294967296 + u32(b, o + 4);
const tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta']);
const VIDEO_TYPES = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'dvh1', 'dvhe', 'dav1', 'dva1', 'mp4v', 'hev1']);
const AUDIO_TYPES = new Set(['mp4a', 'ac-3', 'ec-3', 'opus', 'flac', 'samr']);
const CODEC_NAME = { avc1: 'h264', avc3: 'h264', hvc1: 'hevc', hev1: 'hevc', dvh1: 'hevc', dvhe: 'hevc', dav1: 'av1', dva1: 'av1', mp4v: 'mpeg4' };

function walk(buf, off, end, cb) {
  while (off + 8 <= end) {
    const size = u32(buf, off);
    const type = tag(buf, off + 4);
    let len = size, hdr = 8;
    if (size === 1) { len = u64(buf, off + 8); hdr = 16; }
    else if (size === 0) len = end - off;
    if (len < 8 || off + len > end + 1) break;
    cb(type, off + hdr, off + len);
    off += len;
  }
}

export async function probeLocalFile(file) {
  try {
    const read = (o, l) => file.slice(o, o + l).arrayBuffer().then((ab) => new Uint8Array(ab));

    // locate moov by skimming top-level box headers only (cheap even for big files)
    let off = 0, moovOff = -1, moovLen = 0;
    while (off + 8 <= file.size) {
      const h = await read(off, 8);
      const t = tag(h, 4);
      let size = u32(h, 0), hdr = 8;
      if (size === 1) { const e = await read(off + 8, 8); size = u64(e, 0); hdr = 16; }
      else if (size === 0) size = file.size - off;
      if (size < 8) break;
      if (t === 'moov') { moovOff = off + hdr; moovLen = size - hdr; break; }
      off += size;
    }
    if (moovOff < 0 || moovLen < 8 || moovLen > 64 * 1024 * 1024) return null;
    const moov = await read(moovOff, moovLen);
    const end = moov.length;

    const out = { w: null, h: null, fps: null, ts: null, codec: null, transfer: null, dv: 0, audio: 0, dur: null, size: file.size };

    // mvhd → duration
    walk(moov, 0, end, (type, b, e) => {
      if (type === 'mvhd') {
        const v = moov[b];
        const ts = u32(moov, b + (v ? 20 : 12));
        const du = v ? u64(moov, b + 24) : u32(moov, b + 16);
        if (ts) out.dur = Math.round(du / ts);
      }
    });

    // each trak
    walk(moov, 0, end, (type, b, e) => {
      if (type !== 'trak') return;
      let ts = null, isVideo = false, isAudio = false, delta = null, counts = 0;
      const deep = (t2, b2, e2) => {
        if (CONTAINERS.has(t2)) { walk(moov, b2, e2, deep); return; }
        if (t2 === 'stsd') { walk(moov, b2 + 8, e2, deep); return; } // ver/flags + entry_count prefix
        if (t2 === 'mdhd') {
          const v = moov[b2];
          ts = u32(moov, b2 + (v ? 20 : 12));
        } else if (t2 === 'hdlr') {
          const h = tag(moov, b2 + 8);
          isVideo = h === 'vide'; isAudio = h === 'soun';
        } else if (t2 === 'stts') {
          const n = u32(moov, b2 + 4);
          let best = 0;
          for (let i = 0; i < n && b2 + 8 + i * 8 + 8 <= e2; i++) {
            const c = u32(moov, b2 + 8 + i * 8);
            const d = u32(moov, b2 + 12 + i * 8);
            if (c > best) { best = c; delta = d; }
            counts += c;
          }
        } else if (VIDEO_TYPES.has(t2) || (t2.startsWith('dv') && t2.length === 4)) {
          isVideo = true;
          out.w = out.w || u16(moov, b2 + 24);
          out.h = out.h || u16(moov, b2 + 26);
          out.codec = out.codec || CODEC_NAME[t2] || t2;
          // scan the sample entry's raw bytes for child boxes we care about
          for (let p = b2 + 8; p + 8 <= e2; p++) {
            const ct = tag(moov, p + 4);
            const cs = u32(moov, p);
            if (cs < 8 || p + cs > e2) continue;
            if (ct === 'colr' && tag(moov, p + 8) === 'nclx') {
              const tc = u16(moov, p + 8 + 4 + 2);
              if (tc === 16) out.transfer = 'smpte2084';
              else if (tc === 18) out.transfer = 'arib-std-b67';
            } else if (ct === 'dvcC' || ct === 'dvvC') {
              out.dv = (moov[p + 8] >> 1) & 0x7f;
            }
            p += cs - 1;
          }
        } else if (AUDIO_TYPES.has(t2) || t2.startsWith('mp4a')) {
          isAudio = true;
        }
      };
      walk(moov, b, e, deep);
      if (isAudio) out.audio += 1;
      if (isVideo && ts && delta) { out.ts = ts; out.fps = Math.round((ts / delta) * 100) / 100; }
    });

    if (!out.w && !out.codec) return null;
    return out;
  } catch {
    return null;
  }
}
