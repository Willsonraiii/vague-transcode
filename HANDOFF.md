# Vague Transcode — Migration / Handoff Notes

## Purpose
Build an online RTXFury-style video optimizer that can be used from any device,
especially a phone. The finished service must run on a cloud server rather than
depend on the user's laptop being powered on. The browser is the interface for
upload, progress, and download; server-side processing performs the optimization.

## Three things to remember

### Final goal achievement
Create a working online personal optimizer that:
- Is reachable from any device and anywhere.
- Accepts a video from a phone or other browser, up to approximately 600 MB.
- Processes it on an online server using a server-side FFmpeg/remux pipeline.
- Preserves the source video samples/frames, resolution, and HDR signaling where
  technically possible.
- Produces an MP4 intended to follow the observed RTXFury transformation as
  closely as possible.
- Lets the user download the result and upload it manually to TikTok Studio.
- Automatically deletes temporary original/output files after successful
  download or timeout.
- Does not depend on the user's Linux laptop being online for everyday use.
- Remains usable as a personal service without paid tiers initially, using a
  free cloud tier if practical.

### Workflow status
- Decided: online cloud service, not an offline laptop-only server.
- Decided: browser/phone upload, online server processing, browser download,
  manual TikTok upload.
- Decided: temporary storage with automatic cleanup.
- DONE (2026-09-29): TikTok Studio CONFIRMED HDR on the pipeline output.
- Done (2026-09-29): the RTXFury second-AAC-track experiment is implemented and
  validated on a synthetic stand-in source in an Arena sandbox
  (`tools/build-rtx-second-aac.js`, branch `rtx-audio-track-experiment`,
  commit `ff9a716`, new file only). The commit is not yet pushed to GitHub —
  apply `/home/user/rtx-work/0001-Add-RTXFury-second-AAC-track-experiment-tool.patch`
  or fetch `/home/user/rtx-work/rtx-audio-track-experiment.bundle` from the
  laptop, or re-create it there.
- Not yet done: running the audio experiment on the REAL source file and
  comparing against the REAL RTXFury reference output; generic timing; server
  integration; deployment; TikTok validation.
- Not yet proven: exact reproduction of RTXFury's proprietary MP4 output and
  TikTok behavior.

### RTX to follow
Treat RTXFury as the reference workflow and output target:
- Follow its browser upload → backend processing → download model.
- Use the supplied RTXFury metadata and MP4 box traces as source-of-truth
  evidence.
- Investigate and reproduce its server-side remux/timing/container behavior
  rather than blindly patching browser FFmpeg.
- Match observed structures only after controlled comparison.
- Never claim equivalence until the result is tested in Files/Gallery and
  TikTok Studio.
- The timing implementation must be generic per input (do not hardcode 1/600,
  600 frames, duration 20, or 19984/19976). The current experiment tools are
  deliberately source-specific; genericity is a separate remaining task.

## Current status (updated 2026-09-29, after the real-file laptop run)
- The real-file validation ran on the laptop (kit v1). Reference-matching results
  and the corrected tool (v2, commits 7056364 + 2092c92 in the Arena sandbox)
  are ready for a second laptop run with kit v2 (sha256 ac3abe74...).
- Laptop branch state after the kit-v1 run: rtx-audio-track-experiment with the
  v1 tool commit (8012409 locally); not yet pushed. Kit v2 self-updates the tool
  and commits the change.

### Measured reference facts (rtxfury-matching-1790458373247510.mp4)
- Source audio: 471 samples, stts UNIFORM 471x1024 (482304 ticks), 19 chunks /
  6 stsc entries, priming elst (values to re-verify with the full dump).
- Reference track 1: stts 470x2048 + 1x512 (total 963072 = 4224 + 19976ms*48,
  i.e. the FINAL SAMPLE IS TRIMMED so media ends exactly at the edit end);
  re-chunked to 470 one-sample chunks, stsc [(1,1),(470,2)], stco 470 entries;
  sgpd/sbgp present; starts DTS -4224 with skip-samples 4224.
- Reference track 2: NO edts/elst and NO ctts (plain track: DTS 0, pts == dts,
  2048 packet durations, 4710 packets); stts 470x2048 + 1x512 + 4239x1;
  stsc [(1,1),(470,2),(471,4239)]; stco 471 entries — the FIRST 470 ARE SHARED
  with track 1 (identical offsets; no duplicated payload bytes); mdhd duration
  958848 (= edit duration in media ticks, NOT the stts sum); tkhd 19976;
  sgpd/sbgp present.
- Reference file layout: filler bytes (4239x8) appended at EOF OUTSIDE the
  declared mdat size; the reference was fully re-interleaved (audio one packet
  per chunk between video chunks — ffmpeg-style remux), unlike our
  byte-preserving remux. Size growth over source: 61,107 bytes total
  (fillers 33,912 + moov growth) — the earlier "+0.5 MB" observation measures
  59.7 KB on this pair.
- Reference container: ftyp isom/isomiso2mp41 28B + 8B free box; mvhd v1 120B;
  format tag encoder "RTX Fury Quality Method ... v21.2 [src 60fps x2]".
  Ours: ftyp mp42/isommp41mp42 (source brands, untouched), mvhd v0 108B,
  creation_time tag present, no encoder tag.
- Disproved by the real dump: the old claim that track 2 has elst (19976,4224)
  — it has NO elst; and the v1 ctts theory.

### v2 tool (tools/build-rtx-second-aac.js)
Matches the measured construction: final-sample trim to edit end, re-chunking,
plain shared-offset second track, sgpd/sbgp kept, fillers at EOF outside mdat,
mdhd=edit ticks. Validated on the synthetic stand-in: track2 packets 0/0/2048,
count = all samples, duration 19.976, copyts PASS, decode errors only from
fillers (expected — the reference decodes the same way; kit v2 decodes the
reference too and prints both error counts).

### Generic pipeline (2026-09-29, while user tests TikTok)
- NEW tools/rtx-pipeline.js (commit 2bba639): one command from any source MP4.
  Derives fps -> speed (60fps x2, 120fps x4), video timescale 19200, final-sample
  split, video/audio edit lists from SOURCE priming (x speed), movie timescale
  1000, then calls the validated split-last-stts + build-rtx-second-aac tools.
- Filler rule: 9 x source audio samples (reference: 4710 = 471x10 total; the
  older 2520-frame reference fits 252x10). UNCONFIRMED - override with
  --filler-count.
- Audio edit duration rule: video_elst - 8 ms (reference 19984/19976).
  UNCONFIRMED (the 320-frame reference had a 9 ms gap) - override with
  --audio-elst-ms.
- build-rtx-second-aac.js fix (commit 7c0d45b): trailing audio samples that
  start at/after the edit end are dropped (was a crash); boundary sample is
  trimmed; short audio stretches the last sample.
- Video mdhd duration is now set to the post-split sum (383680), matching the
  reference; the old staged chain left it at 384000 (pre-split) - a newly
  spotted difference, now fixed in the pipeline tool.
- Validated on four synthetic sources: 600-frame/60fps (matches reference
  structure), 450-frame/7.5s (drop edge case), 120fps/1200-timescale
  (speed 4, 30/1 output), and timescale-90000 (clean rejection - such sources
  need a full remux path, not implemented yet).
- All outputs pass ffmpeg -copyts -c copy validation; track 2 packets start
  0,0,2048 like the reference.

### TikTok Studio test result (2026-09-29) — NOT SUCCESSFUL, recorded honestly
- Test file: real source 1790458373247510.MP4 through the full pipeline
  (second-AAC v2 construction, video timing matched).
- Result: the video plays normally in the gallery (shows its real playtime)
  and TikTok did NOT deliver an HDR output — no HDR tag.
- User-identified causes (both correct):
  1. The Dolby Vision config record was still present (stripDV was false), so
     TikTok took the DV path instead of the HDR/HLG path. The RTXFury
     reference carries no DOVI config record. FIX APPLIED: tools/rtx-pipeline.js
     now uses stripDV:true + rebrand:true (commit f4fa650).
  2. The RTXFury file is NOT playable in the phone gallery / shows no normal
     playtime — only TikTok Studio accepts it. Our file plays normally. The
     reference mvhd is version 1 (120 bytes) and its duration looks broken
     (low 32 bits = 0xFFFFFFFE from the earlier dump; high bits unknown).
     Need the exact mvhd bytes (xxd -s 44 -l 120 on the reference file) to
     replicate. THIS IS THE NEXT REQUIRED INPUT.

### mvhd mystery solved (2026-09-29, from the reference xxd)
- Reference mvhd: version 1, 120 bytes, creation/modification 0, timescale 1000,
  duration = 0xFFFFFFFFFFFFFFFF ("unknown"), rate 1.0, volume 1.0, unity matrix,
  next_track_id 4. This "unknown duration" is why the RTXFury file shows no
  playtime and will not play normally in the phone gallery while TikTok Studio
  still accepts it.
- IMPLEMENTED: tools/build-rtx-second-aac.js --mvhd-v1-unknown writes a
  byte-identical mvhd (verified against the reference xxd on synthetic output);
  --drop-udta removes the udta/creation_time tag (reference moov has no udta).
  tools/rtx-pipeline.js passes both by default and now derives the video elst
  media_time from the first ctts offset x speed (synthetic: 640 x 2 = 1280,
  matching the reference).
- ffprobe still reports format duration 19.983333 (computed from tracks), same
  as the reference.

## TIKTOK STUDIO VALIDATION — SUCCESS (2026-09-29)

The full pipeline output was tested in TikTok Studio by the user and TikTok
DELIVERED HDR. This is the first validated success of the project.

Tested file chain: real source 1790458373247510.MP4 -> tools/rtx-pipeline.js
(with tools/build-rtx-second-aac.js v2, stripDV, rebrand, mvhd v1 unknown
duration, drop-udta, video elst from first ctts offset).

Validated by the user in TikTok Studio:
- HDR output: YES (HDR tag present).
- Rendering took noticeably long ("taking time to render due to fps") -
  expected: TikTok re-encodes the full 600-frame 10-bit HLG stream.
- Gallery behaviour of the uploaded file: not re-checked after the mvhd fix
  (the unknown-duration header should make it show no playtime, like RTXFury).

What made the difference after the first failed test:
1. stripDV:true - plain HLG instead of Dolby Vision (first test: no HDR tag).
2. mvhd v1 unknown duration + udta removal (gallery/playtime behaviour).
3. Video elst media_time from first ctts offset x speed (was wrongly 0).

Still to verify later (not blocking): final delivered fps/quality stats of the
posted video, SDR fallback behaviour, other sources (120fps), other lengths.

The processing method is now VALIDATED end to end. Remaining work is the
online service (see ONLINE-SERVICE-PLAN.md) and deployment.

### Remaining open questions / known differences
1. Reference track 1 mdhd duration (ours: 963072 stts sum) - needs the full
   reference dump to confirm.
2. mdat interleave order (reference re-interleaved; we preserve source order).
3. ftyp compatible brands on the real source: ours isommp41mp42 (source brands
   kept), reference isomiso2mp41; reference also has the 8-byte free box
   BEFORE moov, ours after. Cosmetic.
4. The -8ms audio elst rule and the 10x filler rule need a second reference
   file to confirm.
5. First TikTok test failed on HDR (Dolby Vision record kept). Fixed with
   stripDV:true + rebrand (commit f4fa650); NOT yet re-tested in TikTok.
6. Do NOT claim TikTok success - TikTok Studio validation still pending.

## Important conclusions
- A browser being used to upload/download does not prove browser-side
  processing. RTXFury's login, tiers, upload quotas, and optimization stage are
  consistent with a backend service.
- Do not treat one MP4-box patch as proof of reproducing RTXFury's bypass.
- Do not repeat the failed `-itsscale` plus one-tick/`00:00` approach.
- Do not claim TikTok success without TikTok Studio validation.
- Duplicating an AAC track requires full sample-table construction (stts/stsc/
  stsz/stco + elst/ctts semantics); a byte-copy of the trak is not enough.

## Relevant files
- `tools/build-rtx-second-aac.js`: NEW second-AAC-track experiment tool.
- `tools/split-last-stts.js`, `tools/patch-rtx-movie-time.js`: validated video
  experiment tools (unchanged).
- `lib/rtx-duration.js`, `lib/rtx-edit.js`: timing experiment libs (unchanged).
- `lib/remux.js`: lossless faststart remuxer (unchanged).
- `server-lossless.js`: baseline server (unchanged, must not be broken).
- Sandbox session artifacts: `/home/user/rtx-work/` (validation-log.md,
  run-stage1.mjs, dump-boxes.py, synthetic-source.mp4, patch + bundle files).

## Planned next session
1. Re-run kit v2 on the laptop (bash vague-audio-kit.sh, sha256 ac3abe74...):
   it self-updates the tool to v2, re-runs the chain on the real source,
   asserts the reference-matched values (470x2048+1x512, mdhd 958848, no elst,
   stco 471, size growth == moovDelta + filler bytes), decodes the reference
   for error-count comparison, and produces FULL box dumps of source,
   reference, and our output.
2. Paste the report back; reconcile any remaining differences (open questions
   1-2 above get answered by the full dumps).
3. If all assertions pass: push the branch from the laptop
   (git push origin rtx-audio-track-experiment). Still no PR merges.
4. Files/Gallery playback test, then TikTok Studio upload — record the exact
   result here either way.
5. Then: generic timing, container structure (ftyp/mvhd/encoder tag/free box,
   possibly re-interleave), server pipeline, deployment.

## Platform and repository locations
- Windows: repository clone assumed under Desktop unless specified otherwise.
- Linux: active clone at `/home/willson/Desktop/vague-transcode`.
- Arena sandbox (2026-09-29): clone at `/home/user/vague-transcode` (from
  GitHub; no push credentials — patch/bundle provided).

## Operating rule
At the end of every project session, update this migration/handoff file so
another agent can continue without requiring the user to restate the history.
