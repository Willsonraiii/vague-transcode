function boxType(b, o) {
  return b.toString('ascii', o + 4, o + 8);
}

function walkBoxes(b, start, end, callback) {
  let o = start;

  while (o + 8 <= end) {
    let size = b.readUInt32BE(o);
    const type = boxType(b, o);
    let header = 8;

    if (size === 1) {
      size = Number(b.readBigUInt64BE(o + 8));
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }

    if (size < header || o + size > end) {
      throw new Error(`Invalid ${type} box.`);
    }

    callback({
      start: o,
      end: o + size,
      content: o + header,
      type,
    });

    o += size;
  }
}

export function patchVideoEditList(input, durationSeconds = 20, mediaTime = 1280) {
  const b = Buffer.from(input);
  let moov = null;
  let movieTimescale = null;
  const tracks = [];

  walkBoxes(b, 0, b.length, (box) => {
    if (box.type === 'moov') moov = box;
  });

  if (!moov) throw new Error('No moov box found.');

  walkBoxes(b, moov.content, moov.end, (box) => {
    if (box.type === 'mvhd') {
      const version = b[box.content];
      movieTimescale = version === 1
        ? b.readUInt32BE(box.content + 20)
        : b.readUInt32BE(box.content + 12);
    }

    if (box.type === 'trak') {
      tracks.push(box);
    }
  });

  if (!movieTimescale) {
    throw new Error('Movie timescale not found.');
  }

  let patched = false;

  for (const trak of tracks) {
    let handler = null;
    let elst = null;

    function scan(start, end) {
      walkBoxes(b, start, end, (box) => {
        if (box.type === 'hdlr') {
          handler = b.toString(
            'ascii',
            box.content + 8,
            box.content + 12,
          );
        }

        if (box.type === 'elst') {
          elst = box;
        }

        if (['mdia', 'minf', 'edts'].includes(box.type)) {
          scan(box.content, box.end);
        }
      });
    }

    scan(trak.content, trak.end);

    if (handler !== 'vide' || !elst) continue;

    const version = b[elst.content];
    if (version !== 0) {
      throw new Error('Version-1 edit lists are not supported by this test.');
    }

    const entryCount = b.readUInt32BE(elst.content + 4);
    if (entryCount < 1) {
      throw new Error('Video edit list has no entries.');
    }

    const firstEntry = elst.content + 8;
    const movieDuration = Math.round(durationSeconds * movieTimescale);

    b.writeUInt32BE(movieDuration, firstEntry);
    b.writeInt32BE(mediaTime, firstEntry + 4);

    patched = true;
    break;
  }

  if (!patched) {
    throw new Error('Video edit list was not found.');
  }

  return {
    buffer: b,
    movieTimescale,
    durationSeconds,
    movieDuration: Math.round(durationSeconds * movieTimescale),
    mediaTime,
  };
}
