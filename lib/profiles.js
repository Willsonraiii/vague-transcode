/**
 * Vague HD — Transcode Decision Engine
 * ------------------------------------
 * Pure, dependency-free. Input: a probe of the source + a target platform.
 * Output: an explicit encode plan + the exact FFmpeg argv to execute.
 *
 * This file is the product. Web (wasm), extension, desktop (Tauri),
 * iOS (FFI) and server (Forge) all call `plan()` and differ only in
 * how they *execute* the returned argv.
 *
 * Design rules:
 *   1. Never silently change frame rate. Preserve source fps exactly.
 *   2. Never let the platform tonemap. We tonemap, or we pass HDR through.
 *   3. Never upscale. Ever.
 *   4. Every decision carries a human-readable reason (UI + trust).
 */



// ---------------------------------------------------------------------------
// Platform capability matrix  (verified Sept 2026 — see SPEC.md for sources)
// ---------------------------------------------------------------------------

const PLATFORMS = {
  tiktok: {
    label: 'TikTok',
    // MEASURED 2026-09-27 (owner's account): a 4K 60 Dolby Vision upload
    // was DELIVERED back by TikTok as 4K 60 HDR — post downloaded with a
    // third-party downloader, gallery reads "HDR 4K 60". 120 fps content is
    // also served on-platform. The old "~1080p at 2–2.5 Mbps delivery
    // ceiling" held for one old reference video, not for this account.
    // Delivered bitrate of the 4K rendition: not yet measured.
    maxWidth: 2160, maxHeight: 3840,
    maxFps: 120,
    // CORRECTED 2026-09: TikTok DOES render HDR. Confirmed by the
    // "Standard Video Playback" accessibility toggle (Sept 2025) that lets
    // viewers dim HDR, and by colorist reports that TikTok accepts PQ where
    // Instagram does not. Supports HLG, PQ, and iPhone Dolby Vision 8.4.
    hdr: true,
    hdrRequiresIosApp: false,      // unlike Instagram — any upload path works
    hdrMaxHeight: 3840,            // 4K HDR accepted (delivery above 1080p unverified)
    hdrCodec: 'hevc', hdrProfile: 'main10',
    hdrFragile: true,              // mis-tagged HDR = the washed-out grey look
    codec: 'h264', profile: 'high', level: '4.2',
    // Above ~25 Mbps TikTok gains nothing; below ~8 it starves its own encoder.
    bitrateFloorMbps: 10, bitrateCeilMbps: 20,
    maxFileMB: { mobile: 287.6, web: 4096 },
    preferredUpload: 'web',
    safeZones: { top: 120, bottom: 250, right: 150 },
  },
  ig_reels: {
    label: 'Instagram Reels',
    maxWidth: 1080, maxHeight: 1920,
    maxFps: 60,
    hdr: true,                     // iOS app only, Dolby Vision Profile 8.4
    hdrRequiresIosApp: true,
    hdrMaxHeight: 1920,            // 4K HDR is NOT processed
    codec: 'h264', profile: 'high', level: '4.2',
    hdrCodec: 'hevc', hdrProfile: 'main10',
    bitrateFloorMbps: 10, bitrateCeilMbps: 22,
    maxFileMB: { mobile: 4096, web: 4096 },
    preferredUpload: 'ios_app',
    safeZones: { top: 250, bottom: 350, right: 150 },
  },
  ig_story: {
    label: 'Instagram Story',
    maxWidth: 1080, maxHeight: 1920,
    maxFps: 30,                    // stories are consistently capped at 30
    hdr: false,
    codec: 'h264', profile: 'high', level: '4.2',
    bitrateFloorMbps: 8, bitrateCeilMbps: 16,
    maxFileMB: { mobile: 4096, web: 4096 },
    preferredUpload: 'mobile',
    safeZones: { top: 250, bottom: 250, right: 150 },
  },
  yt_shorts: {
    label: 'YouTube Shorts',
    maxWidth: 1080, maxHeight: 1920,
    maxFps: 60,
    hdr: true, hdrRequiresIosApp: false,
    hdrMaxHeight: 3840,
    codec: 'h264', profile: 'high', level: '4.2',
    hdrCodec: 'hevc', hdrProfile: 'main10',
    bitrateFloorMbps: 12, bitrateCeilMbps: 30,
    maxFileMB: { mobile: 4096, web: 262144 },
    preferredUpload: 'web',
    safeZones: { top: 220, bottom: 230, right: 150 },
  },
};

// Frame rates the platforms' encoders bucket cleanly.
const CLEAN_FPS = [24, 25, 30, 48, 50, 60, 120];

// ---------------------------------------------------------------------------
// Frame rate: the part everyone gets wrong
// ---------------------------------------------------------------------------

/**
 * Preserve source fps exactly when legal. Only ever reduce, and only by an
 * integer factor so motion cadence stays even (120->60, 90->30, never 120->50).
 */
function decideFps(src, platform) {
  const fps = src.fps;
  const cap = platform.maxFps;

  if (!fps || !isFinite(fps) || fps <= 0) {
    return { fps: 30, mode: 'cfr', changed: true,
      reason: 'Frame rate unreadable from source; defaulting to 30 CFR.' };
  }

  // Snap tiny float error (59.94006 -> 59.94, 29.97002 -> 29.97) but do NOT
  // round 59.94 up to 60 — that would cause duplicate frames.
  const r = Math.round(fps * 1000) / 1000;

  if (r <= cap + 0.01) {
    if (src.vfr) {
      return { fps: r, mode: 'cfr', changed: false,
        reason: `Source is variable frame rate. Locking to constant ${r} fps — same rate, no frames added or dropped. VFR is the #1 cause of platforms silently re-timing your video.` };
    }
    return { fps: r, mode: 'cfr', changed: false,
      reason: `Source ${r} fps is within ${platform.label}'s ${cap} fps ceiling — preserved exactly.` };
  }

  // Over the cap: find the smallest integer divisor landing at/below cap.
  for (let n = 2; n <= 8; n++) {
    const cand = r / n;
    if (cand <= cap + 0.01) {
      return { fps: Math.round(cand * 1000) / 1000, mode: 'cfr', changed: true,
        divisor: n,
        reason: `${r} fps exceeds ${platform.label}'s ${cap} fps ceiling. Dropping every ${n}${n === 2 ? 'nd' : 'rd/nth'} frame for an even ${Math.round(cand * 1000) / 1000} fps cadence — judder-free. Uploading ${r} fps directly would let the platform decimate it unevenly.` };
    }
  }
  return { fps: cap, mode: 'cfr', changed: true,
    reason: `Resampling ${r} fps down to ${cap} fps.` };
}

// ---------------------------------------------------------------------------
// HDR: pass through, or tonemap properly ourselves
// ---------------------------------------------------------------------------

function decideColor(src, platform, opts, scale) {
  const isHdr = !!src.hdr;
  const fmt = (src.hdrFormat || '').toLowerCase(); // 'dolbyvision' | 'hdr10plus' | 'hdr10' | 'hlg'

  if (!isHdr) {
    return { mode: 'sdr_passthrough', hdr: false,
      primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', pixFmt: 'yuv420p',
      reason: 'Source is SDR. Tagging BT.709 explicitly so the platform never guesses your color space.' };
  }

  // Evaluate against the OUTPUT dimensions, not the source. A 4K HDR master
  // is downscaled to 1080p first — at which point HDR is perfectly legal.
  const outLong = Math.max(scale.width, scale.height);
  const canHdr = platform.hdr &&
    (!platform.hdrRequiresIosApp || opts.uploadPath === 'ios_app') &&
    outLong <= (platform.hdrMaxHeight || 1920);

  if (canHdr) {
    // HDR10+ has no ingest path anywhere. Convert its base layer to DV 8.4 / HLG.
    if (fmt === 'hdr10plus') {
      return { mode: 'hdr_convert', hdr: true, target: 'dv84',
        primaries: 'bt2020', transfer: 'smpte2084', matrix: 'bt2020nc', pixFmt: 'yuv420p10le',
        warning: 'HDR10+ dynamic metadata is not ingested by any social platform. Converting the HDR10 base layer to Dolby Vision Profile 8.4 — you keep the wide gamut and 10-bit, you lose the HDR10+ scene metadata.',
        reason: 'Re-wrapping HDR10+ as Dolby Vision 8.4, the only dynamic-metadata format Instagram carries.' };
    }
    if (fmt === 'dolbyvision') {
      return { mode: 'hdr_passthrough', hdr: true, target: 'dv84',
        primaries: 'bt2020', transfer: 'smpte2084', matrix: 'bt2020nc', pixFmt: 'yuv420p10le',
        reason: 'Dolby Vision preserved as Profile 8.4 with RPU metadata intact — this is the exact format Instagram iOS ingests and delivers as DV Profile 10 in AV1.' };
    }
    return { mode: 'hdr_passthrough', hdr: true, target: 'hlg',
      primaries: 'bt2020', transfer: 'arib-std-b67', matrix: 'bt2020nc', pixFmt: 'yuv420p10le',
      reason: 'HLG HDR preserved with BT.2020 primaries and 10-bit depth.' };
  }

  // Must tonemap. Doing it ourselves with a proper curve beats the platform's
  // naive clip, which is what produces the classic washed-out grey Reel.
  const why = !platform.hdr
    ? `${platform.label} has no HDR pipeline`
    : platform.hdrRequiresIosApp && opts.uploadPath !== 'ios_app'
      ? `${platform.label} only ingests HDR through its iOS app (you selected "${opts.uploadPath}")`
      : `${platform.label} does not process HDR at ${outLong}p`;

  return { mode: 'tonemap', hdr: false, tonemapper: 'bt2390',
    primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', pixFmt: 'yuv420p',
    srcTransfer: fmt === 'hlg' ? 'arib-std-b67' : 'smpte2084',
    reason: `${why}. Tonemapping to SDR with the BT.2390 EETF curve so highlights roll off instead of clipping. This is the single biggest visible win — uploading HDR raw is what makes videos look grey and washed out.` };
}

// ---------------------------------------------------------------------------
// Scaling — never upscale
// ---------------------------------------------------------------------------

function decideScale(src, platform, opts = {}) {
  const { width: w, height: h } = src;
  // Optional explicit downscale (CLI --1080p): TikTok accepts 4K now, so this
  // exists for the A/B test — does a self-downscaled 1080p beat what TikTok's
  // own downscaler delivers from a 4K upload? (HANDOFF §8.3, never measured.)
  const box = opts.force1080 ? { maxWidth: 1080, maxHeight: 1920 } : platform;
  // The platform ceiling is a pixel box, not an orientation. A 16:9 landscape
  // clip must become 1920x1080, not 1080x608 — the long edge maps to the
  // larger limit whichever way the video is turned.
  const maxLong  = Math.max(box.maxWidth, box.maxHeight);   // 1920
  const maxShort = Math.min(box.maxWidth, box.maxHeight);   // 1080
  const long = Math.max(w, h), short = Math.min(w, h);

  if (long <= maxLong && short <= maxShort) {
    return { width: w, height: h, changed: false,
      reason: `${w}×${h} is within ${platform.label}'s upload limits — no rescale, no resampling loss.` };
  }
  const k = Math.min(maxLong / long, maxShort / short);
  const nw = Math.max(2, Math.round((w * k) / 2) * 2);
  const nh = Math.max(2, Math.round((h * k) / 2) * 2);
  return { width: nw, height: nh, changed: true, filter: 'lanczos',
    reason: opts.force1080
      ? `Forced 1080p (--1080p): ${w}×${h} → ${nw}×${nh} with Lanczos. TikTok accepts 4K — this is only for testing whether your own 1080p downscale beats their delivery.`
      : `${w}×${h} exceeds the ${maxLong}p delivery ceiling — ${platform.label} would downscale it anyway, with a fast low-quality filter. Doing it here with Lanczos gives a visibly sharper result.` };
}

// ---------------------------------------------------------------------------
// Bitrate — feed their encoder well without wasting upload
// ---------------------------------------------------------------------------

function decideBitrate(src, platform, scale, fpsPlan, color) {
  const pixels = scale.width * scale.height;
  const base = (pixels / (1080 * 1920)) * 10;             // 10 Mbps @ 1080p30 baseline
  const fpsMul = Math.sqrt(Math.max(fpsPlan.fps, 24) / 30);
  const hdrMul = color.hdr ? 1.35 : 1.0;
  const grainMul = src.grainy ? 1.25 : 1.0;

  let mbps = base * fpsMul * hdrMul * grainMul;
  mbps = Math.max(platform.bitrateFloorMbps, Math.min(platform.bitrateCeilMbps, mbps));
  mbps = Math.round(mbps * 10) / 10;

  // Never exceed the source — re-encoding upward invents nothing.
  let capped = false;
  if (src.bitrateMbps && mbps > src.bitrateMbps * 1.1) {
    mbps = Math.round(src.bitrateMbps * 1.1 * 10) / 10;
    capped = true;
  }

  return {
    targetMbps: mbps,
    maxrateMbps: Math.round(mbps * 1.5 * 10) / 10,
    bufsizeMbps: Math.round(mbps * 3 * 10) / 10,
    crf: color.hdr ? 18 : 17,
    reason: capped
      ? `Target ${mbps} Mbps, capped just above the source's own ${src.bitrateMbps} Mbps — spending more bits than the source contains adds file size, not detail.`
      : `Target ${mbps} Mbps (CRF-guided, ${platform.bitrateFloorMbps}–${platform.bitrateCeilMbps} Mbps window). High enough that ${platform.label}'s encoder has real detail to work from, low enough that nothing is wasted — they re-encode regardless.`,
  };
}

// ---------------------------------------------------------------------------
// Pre-conditioning — spend THEIR bit budget on what matters
//
// This is the closest legitimate thing to a "bypass". We cannot stop the
// platform re-encoding, but we control what its fixed ~2.4 Mbps gets spent on.
// Noise is incompressible: grain can eat 30-50% of their budget, starving the
// actual subject. Removing it before upload makes the DELIVERED result sharper,
// even though we technically discarded data.
// ---------------------------------------------------------------------------

function decidePrecondition(src, platform, color, opts) {
  const steps = [];
  const notes = [];

  if (opts.preconditioning === false) {
    return { steps, notes: ['Pre-conditioning disabled — source passed through as-is.'] };
  }

  // 1. Denoise. The single biggest lever on delivered sharpness.
  if (src.grainy || src.noiseLevel === 'high') {
    steps.push('hqdn3d=1.5:1.2:6:6');
    notes.push('Heavy grain detected. Light denoise applied — grain is incompressible and would consume a large share of the platform\'s fixed bit budget, starving the subject. Removing it before upload makes the delivered video visibly sharper.');
  } else if (src.noiseLevel === 'medium' || (src.iso && src.iso > 1600)) {
    steps.push('hqdn3d=0.8:0.6:4:4');
    notes.push('Moderate sensor noise. Gentle denoise so the platform encoder spends bits on detail rather than noise.');
  }

  // 2. Dither. Banding appears AFTER their compression, not before.
  if (color.pixFmt === 'yuv420p') {
    steps.push('format=yuv420p10le', 'noise=alls=1:allf=t+u', 'format=yuv420p');
    notes.push('Subtle dither added to gradients. Banding in skies and soft backgrounds is created by the platform\'s encoder, not your source — dithering pre-empts it.');
  }

  // 3. Mild sharpen to offset their softening. Conservative: over-sharpening
  //    creates ringing that their encoder then spends bits preserving.
  if (!src.alreadySharpened) {
    steps.push('unsharp=5:5:0.4:5:5:0.0');
    notes.push('Light pre-sharpen to offset the softening the platform encoder applies. Deliberately conservative — aggressive sharpening creates ringing artifacts that waste their bit budget.');
  }

  return { steps, notes };
}


// ---------------------------------------------------------------------------
// Is the source already good enough to upload untouched?
//
// Re-encoding is always lossy. If the file already sits inside the platform's
// envelope, the correct action is to upload it AS-IS — that is the only truly
// lossless option, and no transcoder can beat it.
// ---------------------------------------------------------------------------
function assessAsIs(src, platform, opts) {
  const reasons = [];
  const blockers = [];

  const long = Math.max(src.width || 0, src.height || 0);
  const maxLong = Math.max(platform.maxWidth, platform.maxHeight);

  // Resolution above the delivery ceiling is NOT a blocker — platforms accept
  // 4K and downscale it. It costs upload time, not quality.
  if (long > maxLong) reasons.push(`${long}p will be downscaled by the platform`);

  if (src.vfr) blockers.push('variable frame rate — the platform will re-time it');
  if (src.fps > platform.maxFps + 0.5) blockers.push(`${src.fps} fps exceeds the ${platform.maxFps} fps ceiling`);

  // HDR: if the platform carries it and the file is correctly tagged, touching
  // it in a browser can only make it worse.
  const hdrOk = src.hdr && platform.hdr &&
    (!platform.hdrRequiresIosApp || opts.uploadPath === 'ios_app');
  if (src.hdr && !platform.hdr) blockers.push('HDR is not supported by this destination');

  const sizeMB = src.sizeMB ?? null;
  const cap = opts.uploadPath === 'mobile' ? platform.maxSizeMobileMB : platform.maxSizeWebMB;
  if (sizeMB && cap && sizeMB > cap) blockers.push(`file is larger than the ${cap} MB limit`);

  const containerOnly = !!src.moovAtEnd && blockers.length === 0;

  return {
    recommended: blockers.length === 0,
    hdrPreserved: hdrOk,
    containerOnly,
    reasons, blockers,
    verdict: blockers.length
      ? 'reencode'
      : containerOnly ? 'remux' : 'upload-as-is',
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function plan(src, platformKey, options = {}) {
  const platform = PLATFORMS[platformKey];
  if (!platform) throw new Error(`Unknown platform: ${platformKey}`);

  const opts = { uploadPath: platform.preferredUpload, ...options };

  const fpsPlan = decideFps(src, platform);
  const scale = decideScale(src, platform, opts);      // must run BEFORE color:
  const color = decideColor(src, platform, opts, scale); // HDR legality depends on OUTPUT size
  const rate = decideBitrate(src, platform, scale, fpsPlan, color);
  const pre = decidePrecondition(src, platform, color, opts);
  const asIs = assessAsIs(src, platform, opts);

  const warnings = [];
  const notices = [];

  if (color.warning) warnings.push(color.warning);

  if (src.hdr && color.mode === 'tonemap' && platform.hdr && platform.hdrRequiresIosApp
      && opts.uploadPath !== 'ios_app') {
    warnings.push(`Your source is HDR and ${platform.label} CAN carry it — but only via its iOS app. Switch the upload path to "ios_app" to keep Dolby Vision instead of tonemapping down to SDR.`);
  }
  if (fpsPlan.changed && fpsPlan.divisor) {
    notices.push(`Frame rate reduced ${src.fps} → ${fpsPlan.fps} fps (÷${fpsPlan.divisor}). No platform delivers above ${platform.maxFps} fps.`);
  }
  if (!fpsPlan.changed) {
    notices.push(`Frame rate preserved at ${fpsPlan.fps} fps.`);
  }
  if (src.vfr) {
    notices.push('Variable frame rate normalised to constant — prevents the platform re-timing your audio sync.');
  }
  pre.notes.forEach(n => notices.push(n));

  const est = estimateSize(rate.targetMbps, src.durationSec);
  const limit = platform.maxFileMB[opts.uploadPath === 'web' ? 'web' : 'mobile'] ?? platform.maxFileMB.web;
  if (est > limit) {
    warnings.push(`Estimated output ~${est} MB exceeds the ${limit} MB limit for this upload path. Use the desktop/web uploader, or shorten the clip.`);
  }

  return {
    platform: platform.label,
    platformKey,
    uploadPath: opts.uploadPath,
    output: {
      container: 'mp4',
      codec: color.hdr ? platform.hdrCodec : platform.codec,
      width: scale.width, height: scale.height,
      fps: fpsPlan.fps, fpsMode: fpsPlan.mode,
      hdr: color.hdr, hdrTarget: color.target || null,
      pixFmt: color.pixFmt,
      targetMbps: rate.targetMbps,
      estimatedSizeMB: est,
    },
    decisions: { fps: fpsPlan, color, scale, bitrate: rate, precondition: pre },
    asIs,
    warnings, notices,
    ffmpeg: buildArgs(src, platform, { fpsPlan, color, scale, rate, pre }),
  };
}

function estimateSize(mbps, durationSec) {
  if (!durationSec) return 0;
  return Math.round(((mbps + 0.128) * durationSec) / 8 * 10) / 10; // MB, +audio
}

// ---------------------------------------------------------------------------
// FFmpeg argv construction
// ---------------------------------------------------------------------------

function buildArgs(src, platform, d) {
  const { fpsPlan, color, scale, rate, pre } = d;
  const vf = [];

  if (color.mode === 'tonemap') {
    // Correct order matters: linearise -> tonemap -> back to 709.
    vf.push(
      'zscale=transfer=linear:npl=100',
      'tonemap=tonemap=bt2390:desat=0',
      'zscale=primaries=bt709:transfer=bt709:matrix=bt709:range=limited',
      'format=yuv420p'
    );
  }
  if (scale.changed) {
    vf.unshift(`scale=${scale.width}:${scale.height}:flags=lanczos`);
  }
  if (pre && pre.steps.length) vf.push(...pre.steps);
  if (color.mode !== 'tonemap') {
    vf.push(`format=${color.pixFmt}`);
  }

  const args = ['-hide_banner', '-y', '-i', src.path || 'INPUT'];

  if (vf.length) args.push('-vf', vf.join(','));

  // Hard-lock frame rate. -fps_mode cfr is what actually guarantees
  // "60 in stays 60 out" and kills VFR drift.
  args.push('-r', String(fpsPlan.fps), '-fps_mode', 'cfr');

  const isHevc = color.hdr;
  args.push('-c:v', isHevc ? 'libx265' : 'libx264');
  args.push('-preset', 'slow');
  args.push('-crf', String(rate.crf));
  args.push('-maxrate', `${rate.maxrateMbps}M`, '-bufsize', `${rate.bufsizeMbps}M`);

  if (isHevc) {
    args.push('-profile:v', 'main10', '-tag:v', 'hvc1');
    args.push('-x265-params',
      `hdr-opt=1:repeat-headers=1:colorprim=${color.primaries}:transfer=${color.transfer}:colormatrix=${color.matrix}`);
    if (color.target === 'dv84') args.push('-dolbyvision', '1');
  } else {
    args.push('-profile:v', platform.profile);
    // Level 4.2 tops out around 1080p/60 — a 4K or 120fps output needs 5.2
    // for the stream to stay level-legal.
    const outLong = Math.max(scale.width, scale.height);
    args.push('-level', (outLong > 1920 || fpsPlan.fps > 60) ? '5.2' : platform.level);
    args.push('-x264-params', 'ref=4:bframes=3:aq-mode=3');
  }

  args.push('-colorspace', color.matrix, '-color_primaries', color.primaries, '-color_trc', color.transfer);
  args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  args.push('-movflags', '+faststart');
  args.push(src.outPath || 'OUTPUT.mp4');

  return args;
}


export { plan, PLATFORMS, decideFps, decideColor, decideScale, decidePrecondition, assessAsIs };
