import { readFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';

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

    callback({
      start: o,
      end: o + size,
      content: o + header,
      type,
      header,
    });

    o += size;
  }
}

function concat(parts) {
  return Buffer.concat(parts);
}

function makeBox(original, type, content) {
  const out = Buffer.alloc(8 + content.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, 4, 'ascii');
  content.copy(out, 8);
  return out;
}

function findVideoStts(b, moov) {
  let result = null;

  function scanTrack(trak) {
    let handler = null;
    let stts = null;

    function scan(start, end) {
      readBoxes(b, start, end, (box) => {
        if (box.type === 'hdlr') {
          const h = b.toString('ascii', box.content + 8, box.content + 12);
          if (h === 'vide' || h === 'soun') handler = h;
        }

        if (box.type === 'stts') {
          stts = box;
        }

        if (['mdia', 'minf', 'stbl', 'edts'].includes(box.type)) {
          scan(box.content, box.end);
        }
      });
    }

    scan(trak.content, trak.end);

    if (handler === 'vide' && stts) {
      result = stts;
    }
  }

  readBoxes(b, moov.content, moov.end, (box) => {
    if (box.type === 'trak') scanTrack(box);
  });

  return result;
}

function rebuildRange(b, start, end, target) {
  const parts = [];

  readBoxes(b, start, end, (box) => {
    if (box.start === target.start && box.end === target.end) {
      const oldEntryCount = b.readUInt32BE(box.content + 4);
      if (oldEntryCount !== 1) {
        throw new Error(
          `Expected one stts entry, found ${oldEntryCount}`,
        );
      }

      const count = b.readUInt32BE(box.content + 8);
      const duration = b.readUInt32BE(box.content + 12);

      if (count < 2 || duration < 2) {
        throw new Error('stts entry cannot be split.');
      }

      const content = Buffer.alloc(24);
      b.copy(content, 0, box.content, box.content + 4);
      content.writeUInt32BE(2, 4);
      content.writeUInt32BE(count - 1, 8);
      content.writeUInt32BE(duration, 12);
      content.writeUInt32BE(1, 16);
      content.writeUInt32BE(Math.floor(duration / 2), 20);

      parts.push(makeBox(b, 'stts', content));
      return;
    }

    if (box.start <= target.start && target.end <= box.end) {
      const rebuiltContent = rebuildRange(
        b,
        box.content,
        box.end,
        target,
      );
      parts.push(makeBox(b, box.type, rebuiltContent));
      return;
    }

    parts.push(b.subarray(box.start, box.end));
  });

  return concat(parts);
}

function patchChunkOffsets(moov, delta) {
  function scan(start, end) {
    readBoxes(moov, start, end, (box) => {
      if (box.type === 'stco') {
        const count = moov.readUInt32BE(box.content + 4);
        let at = box.content + 8;

        for (let i = 0; i < count; i++) {
          const oldOffset = moov.readUInt32BE(at);
          const nextOffset = oldOffset + delta;

          if (nextOffset > 0xffffffff) {
            throw new Error('stco offset overflow.');
          }

          moov.writeUInt32BE(nextOffset, at);
          at += 4;
        }
      } else if (box.type === 'co64') {
        const count = moov.readUInt32BE(box.content + 4);
        let at = box.content + 8;

        for (let i = 0; i < count; i++) {
          const oldOffset = moov.readBigUInt64BE(at);
          moov.writeBigUInt64BE(oldOffset + BigInt(delta), at);
          at += 8;
        }
      }

      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts'].includes(box.type)) {
        scan(box.content, box.end);
      }
    });
  }

  scan(0, moov.length);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error(
    'Usage: node tools/split-last-stts.js INPUT.mp4 OUTPUT.mp4',
  );
  process.exit(1);
}

const input = await readFile(inputPath);
let moov = null;

readBoxes(input, 0, input.length, (box) => {
  if (box.type === 'moov') moov = box;
});

if (!moov) throw new Error('No moov box found.');
if (moov.start > 1024) {
  throw new Error('Expected faststart MP4 with moov near the front.');
}

const target = findVideoStts(input, moov);
if (!target) throw new Error('Video stts box not found.');

const newMoov = rebuildRange(input, moov.start, moov.end, target);
const delta = newMoov.length - (moov.end - moov.start);

if (delta !== 8) {
  throw new Error(`Unexpected moov size delta: ${delta}`);
}

patchChunkOffsets(newMoov, delta);

await new Promise((resolve, reject) => {
  const ws = createWriteStream(outputPath);
  ws.on('error', reject);
  ws.on('finish', resolve);
  ws.write(input.subarray(0, moov.start));
  ws.write(newMoov);
  ws.end(input.subarray(moov.end));
});

console.log(JSON.stringify({
  inputBytes: input.length,
  outputBytes: input.length + delta,
  moovDelta: delta,
  outputPath,
}, null, 2));
