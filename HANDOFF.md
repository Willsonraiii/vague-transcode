# Vague Transcode — Migration / Handoff Notes

## LATEST CONTINUATION — WINDOWS 4K TEST READY, WAITING FOR FFPROBE (2026-09-30)

The user returned after the deployment pause for a quick 4K60 check. They are now on Windows and want to test a real video, but optimization HAS NOT started. Continue exactly here:

### Windows environment prepared successfully
- Fresh clone: `%USERPROFILE%\Desktop\vague-transcode-4k-test`
- Branch/commit cloned from GitHub: `online-rtx-service` at `87feb10`
- `npm install` completed: 87 packages, audit reported 0 vulnerabilities. Multer 1.x printed a deprecation warning only; it did not block setup.
- Node: `v24.19.0`
- FFmpeg: `9.0.2-full_build-www.gyan.dev`
- FFprobe: `9.0.2-full_build-www.gyan.dev`
- Git for Windows was updated to `2.55.0.5`.
- Engine setup is complete; no server is running and no media has been processed yet.

### Real video waiting for inspection
- Base filename: `1790757802960597` (extension not yet reported)
- Location: user's Windows Downloads folder
- Phone displayed size: 152.1 MB; Windows PowerShell displayed 145.03 MiB. This is consistent with decimal MB vs binary MiB (`152.1 MB / 1.048576 ~= 145.05 MiB`), not evidence of corruption. The user zipped the file for transfer; MP4/MOV is already compressed, so little ZIP size reduction is expected.
- Actual resolution, FPS, codec, HDR/Dolby Vision metadata, audio, duration, and timescale have NOT been inspected because the user has not yet run/pasted ffprobe output.

### Exact next action
Ask the user to run this read-only PowerShell command (do not optimize yet):

```powershell
$v = Get-ChildItem "$HOME\Downloads\1790757802960597.*" -File | Select-Object -First 1; if (-not $v) { Write-Error "Video not found in Downloads"; exit 1 }; Write-Host "FILE: $($v.FullName)"; Write-Host "SIZE: $([math]::Round($v.Length / 1MB, 2)) MiB"; ffprobe -v error -show_entries stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,time_base,sample_rate,channels,color_range,color_space,color_transfer,color_primaries:stream_side_data -show_entries format=duration,size,format_name -of json "$($v.FullName)"
```

Review the complete output and explicitly confirm: width/height (4K means 3840x2160 or phone portrait equivalent 2160x3840), exact FPS, codec/profile/pixel format, HDR/DV signaling, presence of audio, file size below 600 MB, and video time base compatibility (pipeline requires the video timescale to divide 19200). Only after that should you provide the optimization command. Leave the source untouched. After output generation, validation is mandatory: ffprobe plus `ffmpeg -v error -copyts -vsync 0 -i OUTPUT -map 0 -c copy -f null -`. Never claim this exact 4K60 source works in TikTok until the user confirms it in TikTok Studio.

### Important clarification already given to user
For a 60 fps input, the validated RTXFury-style pipeline keeps all frames and applies x2 timing, yielding approximately 30 fps track timing and twice the source track duration (e.g. 600 frames: 10 s at 60 fps becomes about 20 s at 30 fps). It does not re-encode. We have NOT confirmed that TikTok restores the final published result to the original real-time duration; prior user validation confirmed HDR delivery, not final published duration. Be transparent about this.


## PAUSED STATUS — 2026-09-30

The user asked to pause the local-laptop optimizer/deployment work and return to it later. Laptop and GitHub synchronization completed before the pause:
- `online-rtx-service` was pushed at `87feb10`.
- `rtx-audio-track-experiment` was synchronized at `30814a5`.
- Old divergent laptop history was preserved on GitHub as `laptop-prebundle-rtx-backup` at `2d9bdcc`.
- Former uncommitted laptop changes were committed and pushed on `laptop-uncommitted-backup` (exact resulting commit was not pasted back).
- The laptop ended on `online-rtx-service` with a clean working tree before deployment discussion.
- No deployment was performed. Oracle Always Free was considered, but the user does not want to provide a payment card. No suitable trusted, permanent, no-card free host was selected.
- No new phone/TikTok tests occurred. The last TikTok action remains the second-video HDR success confirmed on 2026-09-29.

NEXT ACTION WHEN USER RETURNS: confirm the laptop branch/status, then either run the service locally or choose a hosting provider. Do not restart the MP4 research or repeat completed synchronization.


## ⭐ START HERE (final migration, 2026-09-29)

0. CONTINUATION START POINT: after the second-video TikTok confirmation the
   user said "keep working" and left; the agent built the whole backend and
   the two-option feature alone; the user returned and DID NOTHING (no
   downloads, no laptop sync, no push, no tests). Start from there.
1. The optimization method is VALIDATED: two real videos, TikTok Studio
   DELIVERED HDR (user-confirmed). The backend is built and tested but NOT
   synced to laptop/GitHub and NOT deployed.
2. AUTHORITATIVE CODE SOURCE: the git bundle `vague-transcode-all-work.bundle`
   (all branches; `online-rtx-service` @ 86d70a0 is the newest). GitHub and
   the laptop are BEHIND — see NEXT-AGENT-PROMPT.md section 3.
3. FIRST TASK for the next agent: laptop + GitHub sync from the bundle
   (NEXT-AGENT-PROMPT.md section 5 has the exact commands).
4. THEN: deployment per DEPLOY.md (Oracle Always Free, facts verified 2026).


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

SECOND video confirmed (2026-09-29): 1790688068207837.MP4 also passed the
full pipeline + user validation (user: "yeah worked"). The method is now
confirmed on two different real videos.

The processing method is now VALIDATED end to end. Remaining work is the
online service (see ONLINE-SERVICE-PLAN.md) and deployment.

### Online backend service v1 (2026-09-29, branch online-rtx-service)
- NEW server-rtx-online.js + public/index.html (commit 7fda562): the validated
  pipeline behind a job web API on port 3005.
  - POST /api/jobs (multipart "video", 600 MB cap) -> {id}
  - GET /api/jobs/:id -> queued|processing|done|failed
  - GET /api/jobs/:id/download -> optimized.mp4, then ALL job files deleted
  - GET /health (checks ffprobe), GET / = mobile upload page with progress bar
  - One job at a time (others queue), 1-hour TTL cleanup, orphaned job dirs
    purged on restart, disk-space guard (needs ~2 GB free), random 32-hex ids,
    no shell interpolation (spawn arg arrays), uploads outside the web root.
- Tested end-to-end in the sandbox: upload -> done -> download validates
  (copyts PASS, track-2 packets 0,0,2048) -> job dir count returns to 0.
  Bad id 400, unknown job 404, wrong file type 400.
- NOT done yet (per ONLINE-SERVICE-PLAN): deployment (Oracle Always Free
  first), HTTPS via reverse proxy, an access token before public exposure,
  progress % from the worker, cancellation.
- Existing servers untouched (server-lossless.js baseline still on 3002 etc.).

### Resolution / FPS support verified (2026-09-29, per the 4K 120FPS max requirement)
The pipeline is resolution- and codec-agnostic (pure container math - it never
touches pixels), verified end to end:
- 4K 3840x2160 60fps: speed x2 derived, stts 179x640+1x320, copyts PASS,
  output 30/1 5.98s, track 2 packets 0,0,2048. PASS
- 4K 3840x2160 120fps (timescale 1200): speed x4 derived automatically,
  copyts PASS, output 30/1. PASS
- 720x1280 60fps HEVC Main 10: PASS. (1080x1920 HEVC 10-bit HLG was already
  proven by the real TikTok Studio HDR success.)
- Audio edit duration and filler rules scale with the actual audio sample
  count (10x rule) - no hardcoded counts anywhere in tools/rtx-pipeline.js.
Notes:
- A 30fps source would derive speed x1 (no slowdown); the method targets
  >30fps sources like RTXFury ("src 60fps x2").
- The pipeline requires the source video timescale to divide 19200 exactly
  (600/1200/2400/4800 OK; e.g. 90000 is rejected with a clear error).
- Test-environment note: this sandbox (2 GB RAM, 2 cores) cannot ENCODE 4K
  10-bit HEVC (x265 OOM) - test inputs were made with x264 where needed.
  That is a test-only limit; the pipeline itself never encodes.
- Deployment note: the pipeline holds the file in memory ~2-3x, so a 600 MB
  4K upload needs roughly 1.5-2 GB RAM on the server. Keep this in mind when
  picking the free VM shape (Oracle Always Free ARM has enough).

### Input acceptance + bitrate guidance (2026-09-29)
ACCEPTABLE (optimizable): 4K 120fps (max, tested) down to any lower
resolution/fps combination - 4K60, 1080p120, 1080p60, 720p etc. Conditions:
MP4/MOV, has an audio track, fps above 30 (60 -> x2, 120 -> x4), video
timescale divides 19200 (phones: 600/1200/2400/4800 - all fine), file under
600 MB. The pipeline is lossless: output quality = input quality exactly.
BITRATE GUIDANCE (recommended capture ranges, not TikTok's official spec):
- 1080p 60fps HEVC 10-bit HDR: 25-35 Mbps (below ~16 Mbps TikTok's re-encode
  visibly degrades)
- 4K 60fps HEVC 10-bit HDR/DV: 45-80 Mbps
- 120fps sources: use the phone's max quality setting
Rule: record at the highest quality the phone offers - our pipeline never
re-encodes, so TikTok receives exactly what was recorded.
600 MB limit = max length by bitrate: 30 Mbps ~ 2.6 min, 40 Mbps ~ 2 min,
50 Mbps ~ 1.6 min, 25 Mbps ~ 3.2 min.

### Backend v2 (2026-09-29, branch online-rtx-service, commit 1c34192)
Everything from ONLINE-SERVICE-PLAN.md's security list now implemented:
- ACCESS_TOKEN env: every /api route requires it (header x-access-token or
  ?token=) when set; unset = open for local dev. Health reports auth mode.
- Progress: tools/rtx-pipeline.js emits additive stderr markers
  (5/35/55/70/95/100 + stage); server parses them into job status; UI shows %.
- Cancellation: DELETE /api/jobs/:id kills a running job (SIGTERM) and
  deletes its files; queued jobs delete instantly.
- Processing timeout: PROCESS_TIMEOUT_MS (default 30 min) kills stuck jobs.
- Dockerfile.online (node:20-slim + ffmpeg, arm64/x64) and docker-compose.yml
  (restart policy, 4 GB mem limit, jobs volume, daily keepalive container).
- .env.example documents all settings; npm run start:online.
- DEPLOY.md: full Oracle Always Free deployment steps (facts verified 2026:
  A1.Flex 4 OCPU/24 GB RAM/200 GB disk/10 TB egress, card verification,
  7-day idle reclamation, capacity lottery), Caddy HTTPS, systemd path,
  rollback.
All 10 endpoint tests passed in-sandbox (401s with wrong/missing token,
upload+progress+download with token, queued/running cancellation, cleanup).

### Two optimization options (2026-09-29, user-requested)
The service now offers two modes (upload field "mode" = "hdr" | "standard"):
- FPS + Quality + HDR (default, "hdr"): the validated full path - fps/quality
  bypass PLUS Dolby Vision -> plain HLG conversion (what made TikTok deliver
  HDR in the confirmed test).
- FPS + Quality ("standard"): same bypass, but the video's own HDR signalling
  is left untouched (--keep-dv). For DV sources this is UNVALIDATED on TikTok
  (our single test with DV kept showed no HDR tag - that is why hdr is the
  default). For non-DV sources both modes produce byte-identical output
  (verified by sha256).
UI: two tappable option cards (default HDR); after processing the UI reports
what was detected ("Dolby Vision detected - converted to HLG" / "No Dolby
Vision found - both options identical for this video"). The pipeline prints a
machine-readable PIPELINE_RESULT line; the server stores it as job.result and
exposes it in the status API.
Validation done: hdr mode, standard mode, invalid-mode fallback, byte-identical
outputs on non-DV source, mode shown in status, UI picker present.
STILL TO VERIFY with the user's real iPhone DV video: standard mode on TikTok
(expect: fps bypass works, no HDR tag) vs hdr mode (validated: HDR).

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
