/**
 * HDR Doctor — diagnose WHY an HDR file looks washed out, grey, or blown out.
 *
 * Context: TikTok and Instagram both render HDR correctly. Most "my video
 * looks washed out" reports are not platform compression — they are a broken
 * colour tag written by the export chain (CapCut is the usual culprit).
 *
 * The platform believes the tags. If the tags lie, the player tone-maps with
 * the wrong curve and you get grey mush. This module reads a probe and names
 * the exact fault.
 *
 * Pure function, no I/O. Feed it the same probe object as core/profiles.js.
 */



const TRANSFER = { PQ: 'smpte2084', HLG: 'arib-std-b67', SDR: 'bt709', UNKNOWN: 'unknown' };

/**
 * @param {object} p probe
 *   { width,height,bitDepth,pixFmt,codec,
 *     colorPrimaries, colorTransfer, colorMatrix, colorRange,
 *     hasDolbyVisionRPU, dvProfile, hasHdr10Metadata, maxCLL,
 *     container, fps, vfr }
 */
function diagnose(p) {
  const findings = [];
  const add = (severity, code, title, symptom, cause, fix) =>
    findings.push({ severity, code, title, symptom, cause, fix });

  const tr = (p.colorTransfer || 'unknown').toLowerCase();
  const pri = (p.colorPrimaries || 'unknown').toLowerCase();
  const mtx = (p.colorMatrix || 'unknown').toLowerCase();
  const depth = p.bitDepth || (String(p.pixFmt || '').includes('10') ? 10 : 8);

  const claimsHdrTransfer = tr === TRANSFER.PQ || tr === TRANSFER.HLG;
  const claimsWideGamut = pri.includes('2020');
  const isHdr = claimsHdrTransfer || claimsWideGamut || !!p.hasDolbyVisionRPU;

  /* ---- 1. THE CLASSIC: HDR pixels, SDR tag -------------------------------
   * CapCut's most common failure. The picture data is PQ/HLG but the file
   * says bt709, so the player applies no tone mapping at all. Highlights
   * flatten, everything looks milky. This is "washed out" in one line. */
  if (claimsWideGamut && tr === TRANSFER.SDR) {
    add('critical', 'HDR_PIXELS_SDR_TAG',
      'Wide-gamut picture tagged as SDR',
      'Washed out, milky, low contrast. Colours look faded rather than vivid.',
      'Primaries say BT.2020 (wide gamut) but the transfer function says bt709 (SDR). The player trusts the transfer tag and skips tone mapping entirely, so HDR-range data is displayed on an SDR curve.',
      'Re-tag with the true transfer (PQ or HLG), or properly convert to SDR with a BT.2390 tonemap. Do not just relabel — pick one pipeline and be consistent.');
  }

  /* ---- 2. Missing transfer tag entirely --------------------------------- */
  if (tr === TRANSFER.UNKNOWN || !p.colorTransfer) {
    add(isHdr ? 'critical' : 'warn', 'NO_TRANSFER_TAG',
      'No transfer function tagged',
      'Inconsistent look across devices — fine on your phone, grey on someone else\'s.',
      'The file carries no transfer characteristic. Every player guesses, and they guess differently. iOS often assumes HLG, Android and web assume bt709.',
      'Always write an explicit transfer tag. For SDR: -color_trc bt709. For HLG: arib-std-b67. For PQ: smpte2084.');
  }

  /* ---- 3. Dolby Vision RPU stripped, PQ left behind ---------------------
   * Editors that re-encode iPhone footage frequently drop the RPU but keep
   * the PQ transfer. DV players expect dynamic metadata, find none, and fall
   * back to a static curve tuned for 1000+ nit mastering. Result: too dark. */
  if (tr === TRANSFER.PQ && !p.hasDolbyVisionRPU && !p.hasHdr10Metadata) {
    add('critical', 'PQ_WITHOUT_METADATA',
      'PQ transfer with no mastering metadata',
      'Too dark overall, crushed shadows, dull highlights on phones.',
      'PQ is an absolute-luminance curve — it needs MaxCLL/MasteringDisplay or a Dolby Vision RPU to tell the display how it was mastered. Without it, players assume a 1000–4000 nit master and map your content far too dark for a ~800 nit phone.',
      'Either restore the Dolby Vision RPU (profile 8.4), or add static HDR10 metadata (MaxCLL/MaxFALL + mastering display primaries), or switch to HLG which is display-relative and needs no metadata.');
  }

  /* ---- 4. iPhone DV downgraded by the editor ---------------------------- */
  if (p.hasDolbyVisionRPU && p.dvProfile && ![5, 8.1, 8.4, 10].includes(Number(p.dvProfile))) {
    add('warn', 'DV_PROFILE_UNSUPPORTED',
      `Dolby Vision profile ${p.dvProfile} is not a social-media profile`,
      'HDR may be ignored entirely, or rendered as flat SDR.',
      'Social platforms ingest profile 8.4 (HLG-compatible). Other profiles are for broadcast or disc and are not recognised by the ingest pipeline.',
      'Re-encode to Dolby Vision profile 8.4, the cross-compatible social profile.');
  }

  /* ---- 5. 10-bit content squeezed into 8-bit ---------------------------- */
  if (isHdr && depth < 10) {
    add('critical', 'HDR_IN_8BIT',
      'HDR content in an 8-bit pixel format',
      'Heavy banding in skies, walls, gradients and skin.',
      `HDR needs 10-bit precision. This file is ${depth}-bit, so the wide luminance range is quantised into 256 steps and gradients tear into visible bands.`,
      'Encode HEVC Main10 with -pix_fmt yuv420p10le. Never deliver HDR as 8-bit.');
  }

  /* ---- 6. Primaries / matrix disagreement -------------------------------- */
  if (claimsWideGamut && mtx.includes('709')) {
    add('critical', 'PRIMARIES_MATRIX_MISMATCH',
      'BT.2020 primaries with a BT.709 matrix',
      'Colours visibly wrong — skin goes orange or green, saturation is off.',
      'The YCbCr→RGB conversion matrix does not match the declared primaries, so every colour is decoded with the wrong coefficients.',
      'Set all three consistently: -color_primaries bt2020 -colorspace bt2020nc -color_trc <pq|hlg>.');
  }
  if (!claimsWideGamut && pri.includes('709') && mtx.includes('2020')) {
    add('critical', 'PRIMARIES_MATRIX_MISMATCH_INV',
      'BT.709 primaries with a BT.2020 matrix',
      'Oversaturated, radioactive-looking colour.',
      'Inverse of the above — mismatched decode coefficients.',
      'Set primaries, matrix and transfer as one consistent set.');
  }

  /* ---- 7. Range mismatch -------------------------------------------------- */
  if (p.colorRange && String(p.colorRange).toLowerCase().includes('full') && !isHdr) {
    add('warn', 'FULL_RANGE_SDR',
      'Full-range SDR video',
      'Blacks look grey and lifted; whites clip early.',
      'Most players assume limited range (16–235) for SDR. Full-range (0–255) data gets re-expanded, lifting blacks.',
      'Encode limited range: -color_range tv, or add scale=...:range=limited.');
  }

  /* ---- 8. HLG at low peak — the safest HDR choice ------------------------ */
  if (tr === TRANSFER.HLG && depth >= 10 && !findings.some(f => f.severity === 'critical')) {
    add('ok', 'HLG_CLEAN',
      'HLG HDR, correctly tagged',
      'Should render correctly on both TikTok and Instagram.',
      'HLG is display-relative: it degrades gracefully to SDR on non-HDR screens without needing metadata. This is the most robust HDR format for social.',
      'No action needed. Keep the tags intact through export.');
  }

  /* ---- 8b. TRANSFER DAMAGE ----------------------------------------------
   * A large, high-resolution file that is nonetheless H.264 / 8-bit / SDR is
   * the signature of a lossy transfer, not of a camera export. Phones record
   * 4K in HEVC 10-bit; nothing shoots 4K in 8-bit H.264 SDR by default.
   * Catching this is high value: the user believes their source is intact. */
  const bigRes = Math.max(p.width || 0, p.height || 0) >= 2160;
  const looksTranscoded = (p.codec === 'h264') && depth === 8 && !isHdr;
  if (bigRes && looksTranscoded) {
    add('critical', 'TRANSFER_DAMAGE',
      'This looks like a transfer-damaged copy, not your original',
      'Your phone shows HEVC / HDR / 60fps, but this file is H.264 8-bit SDR.',
      'Phones record 4K as HEVC 10-bit. A 4K file in 8-bit H.264 with no HDR tags was almost certainly re-encoded in transit — by iOS "Automatic" transfer conversion, by WhatsApp/Messenger, or by a cloud service in storage-saver mode. The quality was lost before TikTok ever saw the file.',
      'Re-transfer the original: iPhone Settings > Photos > Transfer to Mac or PC > KEEP ORIGINALS, then copy over USB. Or send via Telegram as a FILE, or upload to Drive/Dropbox as a file. Never send video through WhatsApp.');
  }

  /* ---- 8c. Frame rate halved — classic compatibility conversion ---------- */
  if (p.fps && Math.abs(p.fps - 30) < 0.2 && bigRes && looksTranscoded) {
    add('warn', 'FPS_HALVED_IN_TRANSIT',
      'Frame rate looks halved',
      'You exported 60fps but this file reads 30fps.',
      'Compatibility transcodes frequently drop 60fps to 30fps at the same time as converting HEVC to H.264. Combined with the 8-bit SDR downgrade, this points at the transfer step rather than your editor.',
      'Verify the frame rate on the phone itself, then re-transfer losslessly over USB.');
  }

  /* ---- 9. Faststart ------------------------------------------------------ */
  if (p.moovAtEnd) {
    add('warn', 'NO_FASTSTART',
      'moov atom at end of file',
      'Slower upload processing; some web uploaders stall or reject.',
      'The index sits after the media data, so the server must read the whole file before it can parse it.',
      'Add -movflags +faststart.');
  }

  const criticals = findings.filter(f => f.severity === 'critical');
  const warns = findings.filter(f => f.severity === 'warn');

  let verdict, headline;
  if (criticals.length) {
    verdict = 'broken';
    headline = criticals.length === 1
      ? `1 fault will make this look wrong after upload.`
      : `${criticals.length} faults will make this look wrong after upload.`;
  } else if (warns.length) {
    verdict = 'risky';
    headline = `${warns.length} issue${warns.length > 1 ? 's' : ''} that may cause inconsistency across devices.`;
  } else {
    verdict = 'clean';
    headline = isHdr
      ? 'HDR is correctly tagged. This should render properly.'
      : 'SDR is correctly tagged. No colour faults found.';
  }

  return {
    verdict, headline,
    isHdr,
    detected: {
      transfer: tr, primaries: pri, matrix: mtx,
      bitDepth: depth,
      dolbyVision: !!p.hasDolbyVisionRPU,
      dvProfile: p.dvProfile ?? null,
    },
    findings,
    criticalCount: criticals.length,
  };
}

/** Known-bad signatures from specific tools, for a friendlier message. */
function identifyToolchain(p) {
  const tr = (p.colorTransfer || '').toLowerCase();
  const pri = (p.colorPrimaries || '').toLowerCase();
  const depth = p.bitDepth || 8;

  if (pri.includes('2020') && tr === 'bt709' && depth === 8) {
    return {
      likely: 'CapCut (HDR source, SDR export preset)',
      advice: 'CapCut kept the wide-gamut primaries but exported an 8-bit bt709 file. In CapCut set the export to HDR, or shoot SDR from the start — the halfway state is what produces washed-out uploads.',
    };
  }
  if (tr === 'smpte2084' && !p.hasDolbyVisionRPU && !p.hasHdr10Metadata) {
    return {
      likely: 'An editor that stripped Dolby Vision metadata',
      advice: 'Your source was probably iPhone Dolby Vision. The editor re-encoded and dropped the RPU while keeping PQ. Export with DV 8.4 preserved, or convert to HLG.',
    };
  }
  return null;
}


export { diagnose, identifyToolchain, TRANSFER };
