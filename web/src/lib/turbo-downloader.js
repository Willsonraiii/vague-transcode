/**
 * High-Speed Universal Parallel Turbo Downloader for Obito Studio
 *
 * Accelerates video downloads across high-latency WAN and mobile connections by
 * splitting the master video into concurrent HTTP Range byte streams over HTTP/2.
 *
 * Features:
 * - Dynamic Device-Aware Concurrency (mobile-tuned to prevent bufferbloat & WebKit stream resets)
 * - Per-Slice Byte-Range Resumption with Automatic Retry on network hiccups
 * - Low-Memory Chunk Buffering (flushes into native Blobs to prevent iOS heap crashes)
 * - Safe binary attachment trigger directly into user's Downloads folder
 */

export function isTurboDownloadSupported() {
  if (typeof window === 'undefined') return false;
  return typeof window.fetch === 'function' && typeof window.Blob === 'function';
}

export function getRecommendedConcurrency(totalBytes) {
  if (typeof navigator === 'undefined') return 3;
  const isMobile =
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

  if (isMobile) {
    // Mobile WebKit / Safari: 2-3 streams yields 2-3x speed without socket congestion or memory crashes
    if (totalBytes > 80 * 1024 * 1024) return 2;
    return 3;
  }
  // Desktop
  if (totalBytes > 100 * 1024 * 1024) return 4;
  return 4;
}

export function formatDownloadSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

/**
 * Executes a resilient multi-thread parallel chunked download with live speed telemetry
 * and automatic byte-range resumption.
 */
export async function downloadWithTurbo({
  url,
  fileName,
  totalBytes,
  headers = {},
  concurrency,
  onProgress,
  signal,
}) {
  if (!totalBytes || totalBytes <= 0) {
    try {
      const headRes = await fetch(url, { method: 'HEAD', headers });
      const cl = headRes.headers.get('content-length');
      if (cl && Number(cl) > 0) totalBytes = Number(cl);
    } catch {}
  }

  if (!totalBytes || totalBytes <= 0) {
    throw new Error('Total bytes required for parallel slice calculation.');
  }

  const effectiveConcurrency = concurrency || getRecommendedConcurrency(totalBytes);
  const numWorkers = Math.min(effectiveConcurrency, Math.max(1, Math.floor(totalBytes / (2 * 1024 * 1024))));
  const sliceSize = Math.floor(totalBytes / numWorkers);
  const slices = [];

  for (let i = 0; i < numWorkers; i++) {
    const start = i * sliceSize;
    const end = i === numWorkers - 1 ? totalBytes - 1 : (i + 1) * sliceSize - 1;
    slices.push({ id: i, start, end, total: end - start + 1, loaded: 0 });
  }

  let totalLoaded = 0;
  let lastSampleTime = performance.now();
  let lastSampleBytes = 0;
  let currentSpeedBps = 0;

  const updateProgress = (bytesAdded = 0) => {
    totalLoaded += bytesAdded;
    const now = performance.now();
    const elapsed = (now - lastSampleTime) / 1000;

    if (elapsed >= 0.2) {
      const deltaBytes = totalLoaded - lastSampleBytes;
      const instantSpeed = deltaBytes / elapsed;
      currentSpeedBps = currentSpeedBps === 0 ? instantSpeed : currentSpeedBps * 0.6 + instantSpeed * 0.4;
      lastSampleTime = now;
      lastSampleBytes = totalLoaded;
    }

    if (onProgress) {
      const pct = Math.min(100, Math.round((totalLoaded / totalBytes) * 100));
      onProgress({
        loaded: totalLoaded,
        total: totalBytes,
        percent: pct,
        speedBps: currentSpeedBps,
        speedFormatted: formatDownloadSpeed(currentSpeedBps),
      });
    }
  };

  updateProgress(0);

  // Array to hold slice Blobs
  const chunkBlobs = new Array(numWorkers);

  const fetchSliceWithRetry = async (slice) => {
    const maxRetries = 3;
    const sliceBlobs = [];
    let currentBatch = [];
    let currentBatchBytes = 0;

    const commitBatch = () => {
      if (currentBatch.length > 0) {
        sliceBlobs.push(new Blob(currentBatch, { type: 'application/octet-stream' }));
        currentBatch = [];
        currentBatchBytes = 0;
      }
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new Error('Download aborted');

      const currentStart = slice.start + slice.loaded;
      const currentEnd = slice.end;

      if (currentStart > currentEnd) {
        commitBatch();
        chunkBlobs[slice.id] = new Blob(sliceBlobs, { type: 'application/octet-stream' });
        return;
      }

      const rangeHeader = `bytes=${currentStart}-${currentEnd}`;
      const reqHeaders = {
        ...headers,
        Range: rangeHeader,
      };

      try {
        const res = await fetch(url, {
          headers: reqHeaders,
          signal,
        });

        if (!res.ok && res.status !== 206) {
          throw new Error(`Server returned HTTP ${res.status} for range ${rangeHeader}`);
        }

        if (!res.body) {
          const buf = await res.arrayBuffer();
          currentBatch.push(buf);
          slice.loaded += buf.byteLength;
          updateProgress(buf.byteLength);
          commitBatch();
          chunkBlobs[slice.id] = new Blob(sliceBlobs, { type: 'application/octet-stream' });
          return;
        }

        const reader = res.body.getReader();

        while (true) {
          if (signal?.aborted) throw new Error('Download aborted');

          const { done, value } = await reader.read();
          if (done) break;

          currentBatch.push(value);
          currentBatchBytes += value.byteLength;
          slice.loaded += value.byteLength;
          updateProgress(value.byteLength);

          // Flush every 4MB into a native Blob to avoid WebKit memory pressure on mobile
          if (currentBatchBytes >= 4 * 1024 * 1024) {
            commitBatch();
          }
        }

        commitBatch();
        chunkBlobs[slice.id] = new Blob(sliceBlobs, { type: 'application/octet-stream' });
        return;
      } catch (err) {
        if (signal?.aborted) throw err;
        console.warn(
          `[Turbo Downloader] Slice ${slice.id} connection hiccup on attempt ${attempt + 1}/${maxRetries + 1}:`,
          err?.message || err
        );

        if (attempt === maxRetries) {
          throw err;
        }

        // Commit received chunks and pause briefly before resuming from the exact byte offset
        commitBatch();
        const backoffMs = 250 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  };

  // Run all parallel workers concurrently with byte-range resume
  await Promise.all(slices.map((slice) => fetchSliceWithRetry(slice)));

  // Combine slices and trigger instant download
  const finalBlob = new Blob(chunkBlobs, { type: 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    try { URL.revokeObjectURL(blobUrl); } catch {}
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 60000);

  if (onProgress) {
    onProgress({
      loaded: totalBytes,
      total: totalBytes,
      percent: 100,
      speedBps: currentSpeedBps,
      speedFormatted: formatDownloadSpeed(currentSpeedBps),
    });
  }
}
