import { readFile, writeFile } from 'node:fs/promises';

function walk(b, start, end, cb) {
  let o = start;

  while (o + 8 <= end) {
    let size = b.readUInt32BE(o);
    const type = b.toString('ascii', o + 4, o + 8);
    let header = 8;

    if (size === 1) {
      size = Number(b.readBigUInt64BE(o + 8));
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }

    if (size < header || o + size > end) {
      throw new Error(`Invalid ${type} box`);
    }

    cb({ start: o, end: o + size, content: o + header, type });

    o += size;
  }
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node tools/patch-rtx-movie-time.js INPUT.mp4 OUTPUT.mp4',
  );
}

const b = await readFile(inputPath);
let moov = null;

walk(b, 0, b.length, (box) => {
  if (box.type === 'moov') moov = box;
});

if (!moov) throw new Error('No moov box found.');

let movieTimescale = null;
let videoFound = false;
let audioFound = false;

walk(b, moov.content, moov.end, (box) => {
  if (box.type === 'mvhd') {
    const version = b[box.content];

    if (version === 1) {
      movieTimescale = box.content + 20;
      b.writeUInt32BE(1000, movieTimescale);
      b.writeBigUInt64BE(19984n, box.content + 28);
    } else {
      movieTimescale = box.content + 12;
      b.writeUInt32BE(1000, movieTimescale);
      b.writeUInt32BE(19984, box.content + 16);
    }
  }

  if (box.type !== 'trak') return;

  let handler = null;
  let tkhd = null;
  let elst = null;

  function scanTrack(start, end) {
    walk(b, start, end, (child) => {
      if (child.type === 'hdlr') {
        handler = b.toString(
          'ascii',
          child.content + 8,
          child.content + 12,
        );
      }

      if (child.type === 'tkhd') tkhd = child;
      if (child.type === 'elst') elst = child;

      if (['mdia', 'minf', 'edts'].includes(child.type)) {
        scanTrack(child.content, child.end);
      }
    });
  }

  scanTrack(box.content, box.end);

  if (!handler || !tkhd || !elst) return;

  const isVideo = handler === 'vide';
  const isAudio = handler === 'soun';

  if (!isVideo && !isAudio) return;

  const editDuration = isVideo ? 19984 : 19976;
  const mediaTime = isVideo ? 1280 : 4224;

  // Version 0 elst: entry duration at +8, media time at +12.
  if (b[elst.content] !== 0) {
    throw new Error('Version-1 edit list not supported by this test.');
  }

  b.writeUInt32BE(editDuration, elst.content + 8);
  b.writeInt32BE(mediaTime, elst.content + 12);

  // Version 0 tkhd duration is content +20.
  // Version 1 tkhd duration is content +28.
  const tkhdVersion = b[tkhd.content];

  if (tkhdVersion === 1) {
    b.writeBigUInt64BE(BigInt(editDuration), tkhd.content + 28);
  } else {
    b.writeUInt32BE(editDuration, tkhd.content + 20);
  }

  if (isVideo) videoFound = true;
  if (isAudio) audioFound = true;
});

if (!movieTimescale || !videoFound || !audioFound) {
  throw new Error('Required movie/video/audio boxes were not found.');
}

await writeFile(outputPath, b);

console.log(JSON.stringify({
  inputBytes: b.length,
  outputBytes: b.length,
  movieTimescale: 1000,
  videoEditDuration: 19984,
  audioEditDuration: 19976,
  videoMediaTime: 1280,
  audioMediaTime: 4224,
}, null, 2));
