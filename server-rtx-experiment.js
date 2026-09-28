import express from 'express';
import multer from 'multer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { faststartRemux } from './lib/remux.js';

const app = express();
const PORT = Number(process.env.PORT || 3003);
const MAX_FILE_SIZE = 600 * 1024 * 1024;

const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: MAX_FILE_SIZE },
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'rtx-timing-experiment',
    maxUploadBytes: MAX_FILE_SIZE,
  });
});

app.post('/api/remux', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing video upload.' });
  }

  const inputPath = req.file.path;
  const workDir = await mkdtemp(path.join(tmpdir(), 'vague-remux-'));
  const outputPath = path.join(workDir, 'optimized.mp4');

  try {
    console.log(`Received ${req.file.originalname} (${req.file.size} bytes)`);

    const inputBytes = await readFile(inputPath);
    const inputBlob = new Blob([inputBytes], { type: 'video/mp4' });

    const result = await faststartRemux(
      inputBlob,
      (percent, label) => {
        console.log(`${percent}% ${label}`);
      },
      {
        // Baseline only: preserve the source structure and samples.
        stripEdits: false,
        stripDV: false,
        zeroDuration: false,
        rebrand: false,
        isoSignature: true,
      },
    );

    const outputBytes = Buffer.from(await result.blob.arrayBuffer());
    await writeFile(outputPath, outputBytes);

    console.log(
      `Created ${outputBytes.length} bytes; moved=${result.moved}; patched=${result.patched}`,
    );

    res.download(outputPath, 'vague-rtx-timing-experiment.mp4', async (error) => {
      await rm(inputPath, { force: true }).catch(() => {});
      await rm(workDir, { recursive: true, force: true }).catch(() => {});

      if (error) {
        console.error('Download failed:', error.message);
      } else {
        console.log('Download completed; temporary files deleted.');
      }
    });
  } catch (error) {
    await rm(inputPath, { force: true }).catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch(() => {});

    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Video exceeds the 600 MB upload limit.',
    });
  }

  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lossless remux server listening on http://0.0.0.0:${PORT}`);
});
