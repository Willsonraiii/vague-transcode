const TARGET_TIMESCALE = 19200;
const SPEED_FACTOR = 2;

function u32(b, o) {
  return b.readUInt32BE(o);
}

function setU32(b, o, v) {
  if (!Number.isInteger(v) || v < 0 || v > 0xffffffff) {
    throw new Error(`Value cannot fit uint32: ${v}`);
  }
  b.writeUInt32BE(v, o);
}

function boxType(b, o) {
  return b.toString('ascii', o + 4, o + 8);
}

function walkBoxes(b, start, end, callback) {
  let o = start;

  while (o + 8 <= end) {
    let size = u32(b, o);
    const type = boxType(b, o);
    let header = 8;

    if (size === 1) {
      if (o + 16 > end) throw new Error('Invalid extended MP4 box.');
      const value = Number(b.readBigUInt64BE(o + 8));
      if (!Number.isSafeInteger(value)) throw new Error('MP4 box too large.');
      size = value;
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }

    if (size < header || o + size > end) {
      throw new Error(`Invalid ${type} box at ${o}.`);
    }

    callback({ start: o, end: o + size, content: o + header, type });
    o += size;
  }
}

function scanTrack(b, start, end) {
  const result = {
    handler: null,
    mdhd: null,
    tkhd: null,
    stts: null,
    ctts: null,
  };

  walkBoxes(b, start, end, (box) => {
    if (box.type === 'hdlr') {
      result.handler = b.toString(
        'ascii',
        box.content + 8,
        box.content + 12,
      );
    }

    if (box.type === 'mdhd') result.mdhd = box;
    if (box.type === 'tkhd') result.tkhd = box;
    if (box.type === 'stts') result.stts = box;
    if (box.type === 'ctts') result.ctts = box;

    if (['trak', 'mdia', 'minf', 'stbl', 'edts'].includes(box.type)) {
      walkBoxes(b, box.content, box.end, () => {});
    }
  });

  // The callback above only observes each level, so recursively scan all
  // descendants for the track fields.
  function recursive(s, e) {
    walkBoxes(b, s, e, (box) => {
      if (box.type === 'hdlr') {
        result.handler = b.toString(
          'ascii',
          box.content + 8,
          box.content + 12,
        );
      }
      if (box.type === 'mdhd') result.mdhd = box;
      if (box.type === 'tkhd') result.tkhd = box;
      if (box.type === 'stts') result.stts = box;
    if (box.type === 'ctts') result.ctts = box;

      if (['mdia', 'minf', 'stbl', 'edts'].includes(box.type)) {
        recursive(box.content, box.end);
      }
    });
  }

  recursive(start, end);
  return result;
}

function getMdhdInfo(b, box) {
  const version = b[box.content];
  if (version === 1) {
    return {
      version,
      timescaleOffset: box.content + 20,
      durationOffset: box.content + 28,
      durationBytes: 8,
      timescale: u32(b, box.content + 20),
      duration: Number(b.readBigUInt64BE(box.content + 28)),
    };
  }

  return {
    version,
    timescaleOffset: box.content + 12,
    durationOffset: box.content + 16,
    durationBytes: 4,
    timescale: u32(b, box.content + 12),
    duration: u32(b, box.content + 16),
  };
}

function getTkhdDuration(b, box) {
  const version = b[box.content];

  if (version === 1) {
    return {
      offset: box.content + 28,
      bytes: 8,
      value: Number(b.readBigUInt64BE(box.content + 28)),
    };
  }

  return {
    offset: box.content + 20,
    bytes: 4,
    value: u32(b, box.content + 20),
  };
}

export function applyRtxDurationExperiment(input) {
  const b = Buffer.from(input);
  let moov = null;
  let mvhd = null;
  let videoTrack = null;

  walkBoxes(b, 0, b.length, (box) => {
    if (box.type === 'moov') moov = box;
  });

  if (!moov) throw new Error('No moov box found.');

  walkBoxes(b, moov.content, moov.end, (box) => {
    if (box.type === 'mvhd') mvhd = box;

    if (box.type === 'trak') {
      const track = scanTrack(b, box.content, box.end);
      if (track.handler === 'vide') videoTrack = track;
    }
  });

  if (!videoTrack?.mdhd || !videoTrack.stts) {
    throw new Error('Video mdhd/stts boxes were not found.');
  }

  const mdhd = getMdhdInfo(b, videoTrack.mdhd);
  const factor = TARGET_TIMESCALE / mdhd.timescale * SPEED_FACTOR;

  if (!Number.isInteger(factor)) {
    throw new Error(
      `Cannot use integer timing factor: ${TARGET_TIMESCALE}/${mdhd.timescale} × 2`,
    );
  }

  const stts = videoTrack.stts;
  const entryCount = u32(b, stts.content + 4);
  let cursor = stts.content + 8;
  let newDuration = 0;

  for (let i = 0; i < entryCount; i++) {
    const count = u32(b, cursor);
    const duration = u32(b, cursor + 4);
    const newSampleDuration = duration * factor;

    if (!Number.isSafeInteger(newSampleDuration)) {
      throw new Error('Sample duration overflow.');
    }

    setU32(b, cursor + 4, newSampleDuration);
    newDuration += count * newSampleDuration;
    cursor += 8;
  }

  // Composition offsets must receive the same additional ×2
  // scaling as sample durations. Otherwise B-frame PTS/DTS ordering breaks.
  if (videoTrack.ctts) {
    const ctts = videoTrack.ctts;
    const version = b[ctts.content];
    const entries = u32(b, ctts.content + 4);
    let at = ctts.content + 8;

    for (let i = 0; i < entries; i++) {
      const count = u32(b, at);
      const oldOffset = version === 1
        ? b.readInt32BE(at + 4)
        : b.readUInt32BE(at + 4);
      const newOffset = oldOffset * SPEED_FACTOR;

      if (version === 1) {
        b.writeInt32BE(newOffset, at + 4);
      } else {
        b.writeUInt32BE(newOffset, at + 4);
      }

      at += 8;
    }
  }

  setU32(b, mdhd.timescaleOffset, TARGET_TIMESCALE);

  if (mdhd.durationBytes === 8) {
    b.writeBigUInt64BE(BigInt(newDuration), mdhd.durationOffset);
  } else {
    setU32(b, mdhd.durationOffset, newDuration);
  }

  if (videoTrack.tkhd) {
    const tkhd = getTkhdDuration(b, videoTrack.tkhd);
    const newTrackDuration = tkhd.value * SPEED_FACTOR;

    if (tkhd.bytes === 8) {
      b.writeBigUInt64BE(BigInt(newTrackDuration), tkhd.offset);
    } else {
      setU32(b, tkhd.offset, newTrackDuration);
    }
  }

  if (mvhd) {
    const version = b[mvhd.content];

    if (version === 1) {
      const offset = mvhd.content + 28;
      const value = Number(b.readBigUInt64BE(offset));
      b.writeBigUInt64BE(BigInt(value * SPEED_FACTOR), offset);
    } else {
      const offset = mvhd.content + 16;
      const value = u32(b, offset);
      setU32(b, offset, value * SPEED_FACTOR);
    }
  }

  return {
    buffer: b,
    sourceTimescale: mdhd.timescale,
    targetTimescale: TARGET_TIMESCALE,
    factor,
    sampleCount: entryCount,
    videoDuration: newDuration,
  };
}
