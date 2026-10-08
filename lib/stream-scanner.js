import { open } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export async function scanTopLevelBoxes(fh, fileSize) {
  const boxes = [];
  let o = 0;
  const headerBuf = Buffer.alloc(16);

  while (o < fileSize) {
    const { bytesRead } = await fh.read(headerBuf, 0, 8, o);
    if (bytesRead < 8) break;
    const size32 = headerBuf.readUInt32BE(0);
    const type = headerBuf.toString('ascii', 4, 8);
    let size = size32;
    let headerSize = 8;
    if (size32 === 1) {
      await fh.read(headerBuf, 8, 8, o + 8);
      size = Number(headerBuf.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size32 === 0) {
      size = fileSize - o;
    }
    boxes.push({ type, start: o, end: o + size, size, headerSize });
    o += size;
  }
  return boxes;
}
