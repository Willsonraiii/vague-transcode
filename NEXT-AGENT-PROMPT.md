# Continuation Prompt — Vague / RTXFury-Style Online Optimizer (FINAL MIGRATION, 2026-09-29)

## LATEST CONTINUATION UPDATE — PAUSED 2026-09-30

The bundle-to-laptop/GitHub synchronization is complete. GitHub received `online-rtx-service` at `87feb10` and `rtx-audio-track-experiment` at `30814a5`. Divergent laptop history was preserved as `laptop-prebundle-rtx-backup` (`2d9bdcc`), and the user's former uncommitted files were preserved on `laptop-uncommitted-backup` (resulting commit hash not reported). Deployment did not occur. Oracle Always Free was discussed, but the user does not want any payment-card requirement, and no alternative host was selected. The user explicitly paused the local-laptop optimizer/deployment process to continue later. No additional TikTok test happened.

When work resumes: first verify laptop `git status` and branch tips; then ask whether the user wants a local run or has selected hosting. Do not redo synchronization, do not deploy without confirmation, and do not claim any test after the second-video TikTok HDR confirmation.


Give the next agent the file `vague-transcode-migration.zip`. It contains
everything: this prompt, HANDOFF.md, and the git bundle with every branch
and commit. (Some chats reject the bare `.bundle` file type — that is why
it ships inside a zip.)

Restore the repository from the zip:
```bash
unzip vague-transcode-migration.zip
git clone vague-transcode-all-work.bundle vague-transcode
cd vague-transcode
git remote set-url origin https://github.com/Willsonraiii/vague-transcode.git
```
(Fallback if zip is also rejected: `vague-transcode-bundle.b64.txt` — run
`base64 -d vague-transcode-bundle.b64.txt > vague-transcode-all-work.bundle`
first, then clone as above.)

The agent must read this file, `HANDOFF.md`, and `ONLINE-SERVICE-PLAN.md`
(both are inside the bundle's repository too) before changing anything.

---

## 1. Role and rules (unchanged discipline)

- Continue the Vague Transcode project. Do not restart history, do not repeat
  failed approaches (list at the end), do not blindly patch MP4 metadata.
- Before changing repository or processing code, state the exact change and
  wait for user confirmation unless the user approved the step.
- Keep experiments in branches. Never merge experiment PRs into `main`
  without the user's explicit decision.
- Validate every MP4 with ffprobe + `ffmpeg -v error -copyts -vsync 0 -i FILE
  -map 0 -c copy -f null -`.
- NEVER claim TikTok success without the user confirming it in TikTok Studio.

## 2. Project status in one paragraph

The RTXFury-style optimization method is FULLY VALIDATED on two real iPhone
videos, including TikTok Studio DELIVERING HDR on the output (user-confirmed
2026-09-29). A complete online backend (upload → job queue → validated
pipeline → progress → download → auto-delete, access token, two optimization
options, Docker + deploy guide) is BUILT AND TESTED in a sandbox but NOT yet
synced to the user's laptop/GitHub and NOT yet deployed. The next agent's
first job is the sync (section 5), then deployment (section 7).

### EXACT timeline of the end of the last session (continuation start point)

1. User confirmed the SECOND video worked in TikTok ("yeah worked").
2. User said: "now work for backend until come back keep working" and LEFT.
3. The agent worked ALONE and completed: backend v2 (access token, progress,
   cancel, timeout, Dockerfile.online, docker-compose.yml, DEPLOY.md), then
   the two optimization options (hdr/standard — requested by the user in a
   short message during that period), then the migration docs.
4. User came back BUT DID NOTHING after that: no files downloaded from the
   chat, no laptop commands run, no git push, no TikTok test of the new
   features. The two-option UI has NEVER been seen or used by the user.
5. Migration package was prepared (this file + the git bundle).

=> CONTINUATION START POINT: exactly at step 4. Everything from step 3 is
un-synced work that exists only in the git bundle (and the previous chat's
workspace). Treat the user as having done NOTHING since the second-video
confirmation; do not assume any sync, push, download, or test happened.
The user's last personal actions in total were: running the pipeline on two
real videos and validating both in TikTok Studio, plus answering questions.
Everything else was agent-side work in the sandbox.

## 3. Where the work lives (CRITICAL — read carefully)

Three copies exist, and they are NOT equal:

| Copy | State |
|---|---|
| **git bundle** `vague-transcode-all-work.bundle` (from the previous chat) | ✅ AUTHORITATIVE — all branches, 16 commits ahead of GitHub |
| Previous chat's workspace `/home/user/vague-transcode` | ✅ same as bundle (source the bundle was built from) |
| GitHub `Willsonraiii/vague-transcode` | ❌ BEHIND: `main` e3ca2c3, `online-server-lossless` c075f11, `rtx-audio-track-experiment` 6c5002b, `rtx-final-sample-experiment` 6c5002b. None of the 2026-09-29 work is pushed. |
| User's laptop `/home/willson/Desktop/vague-transcode` | ❌ BEHIND: has the v1 second-AAC tool commit (local, content of ff9a716) and possibly user-made commits of the same files under different messages. Branch `rtx-audio-track-experiment`. |

The bundle is the single source of truth. Its branches:
- `main` e3ca2c3 (untouched)
- `online-server-lossless` c075f11 (untouched)
- `rtx-final-sample-experiment` 6c5002b (untouched)
- `rtx-audio-track-experiment` 7c0d45b (validated method)
- `online-rtx-service` 86d70a0 (HEAD of all work: method + backend + docs)

Commit chain on `online-rtx-service` (all 2026-09-29):
ff9a716 v1 second-AAC tool → 7056364 reference-matched v2 → 2092c92 stbl fix
→ 7c0d45b drop trailing audio samples → 2bba639 generic pipeline tool →
f4fa650 stripDV+rebrand (HDR fix) → 98a66ed mvhd v1 unknown duration →
30814a5 TikTok success + docs preserved → 01abae8 backend v1 docs → 7fda562
backend v1 (server-rtx-online.js + public/index.html) → 2a1c209 4K/120fps
verification → 38f72a0 acceptance+bitrate guidance → 33594c2 second-video
confirmation → 1c34192 backend v2 (token/progress/cancel/timeout/Docker/
DEPLOY.md) → a10bf3c backend v2 docs → 86d70a0 two optimization options.

In a NEW sandbox the agent can restore everything from the uploaded bundle:
```bash
git clone vague-transcode-all-work.bundle vague-transcode
cd vague-transcode && git remote set-url origin https://github.com/Willsonraiii/vague-transcode.git
git fetch origin   # GitHub refs visible for comparison; no push credentials
```

## 4. The validated method (what tools/rtx-pipeline.js does)

One command: `node tools/rtx-pipeline.js INPUT.mp4 OUTPUT.mp4`
(plus optional `--keep-dv`, `--audio-elst-ms N`, `--filler-count N`).

From any source MP4 (with audio, fps>30, video timescale divides 19200):
1. `lib/remux.js` faststartRemux: moov to front, video timescale → 19200,
   chunk offsets rewritten, `stripDV` (Dolby Vision → plain HLG) and
   `rebrand` (major brand isom) — UNLESS `--keep-dv`.
2. Timing derived per input: fps→speed (60→x2, 120→x4), video stts scaled,
   final-sample split (`tools/split-last-stts.js`), video elst duration
   (ceil to ms, movie timescale 1000) and media_time from first ctts
   offset × speed, audio elst from source priming × speed (duration =
   video elst − 8 ms, UNCONFIRMED rule, overridable).
3. `tools/build-rtx-second-aac.js` (v2, reference-matched): audio stts scaled
   with final-sample TRIM to the edit end (471×1024 → 470×2048 + 1×512),
   re-chunked one-sample-per-chunk (last chunk 2), audio elst kept,
   tkhd/mdhd = edit values; SECOND audio track: plain (NO elst, NO ctts —
   DTS 0, pts==dts, 2048 durations), SHARES track 1's chunk offsets (no
   duplicated bytes), fillers appended at EOF outside the declared mdat
   (count = 9 × audio samples by the 10x rule, payload 0000000400000000,
   1 tick each), mdhd = edit duration in ticks, sgpd/sbgp kept; mvhd →
   version 1, 120 bytes, duration 0xFFFFFFFFFFFFFFFF ("unknown" — this is
   why the file shows no playtime and won't play in phone galleries),
   udta (creation_time) dropped, next_track_id updated, all offsets shifted.

Why each piece matters (all measured from the real RTXFury reference file):
- DV→HLG + everything above = TikTok DELIVERED HDR (confirmed).
- Without DV strip, TikTok did NOT deliver HDR (first test failed).
- Second track pattern: packets `0,0,2048`, 4710 = 471×10 samples.
- Reference growth over source: 61,107 bytes (not "0.5 MB" — that earlier
  observation measures 59.7 KB on this pair).

## 5. FIRST TASK: sync the user's laptop + GitHub from the bundle

The user must download `vague-transcode-all-work.bundle` from the previous
chat (or the next agent re-creates the bundle after cloning it — content is
identical). Then ON THE LAPTOP (user is authenticated with GitHub there):

```bash
cd ~/Desktop/vague-transcode
git remote add bundle ~/Downloads/vague-transcode-all-work.bundle
git fetch bundle
git checkout -B online-rtx-service bundle/online-rtx-service
git branch -f rtx-audio-track-experiment bundle/rtx-audio-track-experiment
git push -u origin online-rtx-service
git push origin rtx-audio-track-experiment
git remote remove bundle
```

Notes:
- The laptop's local v1 commit(s) become redundant (same content exists in
  the bundle's history under different hashes). If git refuses `branch -f`
  because the user is ON that branch, checkout the new branch first.
- Never force-push `main`. `main` is identical in the bundle and on GitHub.
- After the push: verify on GitHub that `online-rtx-service` tip = 86d70a0.

## 6. The backend (branch online-rtx-service)

Files: `server-rtx-online.js` (Express, port 3005), `public/index.html`
(mobile UI), `Dockerfile.online`, `docker-compose.yml` (with free-tier
keepalive container), `.env.example`, `DEPLOY.md` (full Oracle steps),
`tools/rtx-pipeline.js` (progress markers 5/35/55/70/95/100 + a
machine-readable `PIPELINE_RESULT {...}` summary line).

API (all /api routes require the token when ACCESS_TOKEN is set — header
`x-access-token` or `?token=`):
- `POST /api/jobs` multipart fields `video` (≤600 MB) + `mode`
  (`hdr` default | `standard`) → `{id}`
- `GET /api/jobs/:id` → status/progress/stage/mode/result
- `GET /api/jobs/:id/download` → file, then job dir deleted
- `DELETE /api/jobs/:id` → cancel running/queued job + cleanup
- `GET /health`; `GET /` = UI (two option cards, token box, progress,
  cancel, download button, DV-detection message)

Two optimization options (user-requested 2026-09-29):
- `hdr` (default, RECOMMENDED): fps+quality bypass + Dolby Vision → HLG.
  This is the TikTok-validated path.
- `standard` (`--keep-dv`): bypass only, source HDR signalling untouched.
  For non-DV sources both modes produce byte-identical output (verified).
  For DV sources, standard mode is expected to lose the HDR tag on TikTok
  (matches the one failed test) — still officially UNVALIDATED on TikTok.

Storage policy (implemented): jobs in `./jobs/<32-hex>/`, deleted on
download; 1 h TTL sweeper; orphaned dirs purged on restart; disk guard
(needs ~2 GB free); one job at a time (others queue); processing timeout
30 min (SIGTERM); no shell interpolation anywhere.

Tested in sandbox: full job cycle, 401s, cancellation (queued + running),
invalid mode fallback, both modes byte-identical on non-DV input, orphan
cleanup. NOT tested: real 600 MB upload latency, multi-user load.

## 7. Next steps after sync

1. **Deploy** per `DEPLOY.md` (in the repo). Facts verified 2026: Oracle
   Always Free = VM.Standard.A1.Flex up to 4 ARM OCPU + 24 GB RAM, 200 GB
   block storage, 10 TB/month egress, credit-card verification (not
   charged within limits), ~7-day idle reclamation (keepalive included),
   ARM capacity can be hard to get (try multiple regions). Alternative:
   any cheap Linux VPS works (Docker image is arch-neutral).
2. HTTPS with Caddy before real use (token over plain HTTP is readable).
3. Have the user verify on the phone: upload → progress → download →
   TikTok Studio, both modes, including a real iPhone DV video.
4. Optional later: Discord login/real accounts, job history, multiple
   workers (all listed in ONLINE-SERVICE-PLAN.md "Future optional").

## 8. Open questions / known differences (non-blocking)

- standard mode on a real DV video in TikTok (expected: no HDR tag) — user
  check pending.
- Reference track 1 mdhd duration (ours 963072 = stts sum) never confirmed.
- Reference file is fully re-interleaved (audio packet-per-chunk between
  video); we preserve the source interleave. Demux-equivalent, cosmetically
  different; size impact only.
- The −8 ms audio elst rule and 10× filler rule are from ONE reference
  file. A second RTXFury reference would confirm (ask the user for one
  someday).
- Reference ftyp minor_version 512, encoder tag "RTX Fury Quality Method
  ... v21.2 [src 60fps x2]" — we do not write an encoder tag.
- 30 fps sources derive speed x1 (no slowdown) — method targets >30 fps.
- Sources whose video timescale does not divide 19200 (e.g. 90000) are
  rejected with a clear error; a real remux path for them is not built.
- ffprobe still shows format duration 19.983333 for our output (computed
  from tracks) — same as the reference; only mvhd says unknown.

## 9. Failed approaches — do NOT repeat

- `-itsscale` + one-tick/`00:00` duration patch (worse fps/quality).
- Browser-only WASM remux claimed as RTXFury-equivalent.
- `stripEdits:true` (RTXFury keeps edit lists).
- In-place 4-byte `dby1` replacement (ftyp must be rebuilt/shrunk).
- Second AAC track WITHOUT full sample tables (stts/stsc/stsz/stco) — a
  byte-copy of the trak is invalid.
- ctts composition offset on track 2 (v1 theory — disproven by the real
  reference dump: track 2 has NO ctts, NO elst).
- Duplicating the audio payload for track 2 (reference shares offsets).
- Keeping Dolby Vision when HDR delivery is the goal (TikTok test failed).
- Trusting the source's video elst media_time (real source had 0; reference
  uses 1280 = first ctts × speed).
- Claiming TikTok success without TikTok Studio confirmation.

## 10. Key user-facing facts (keep saying these simply)

- Acceptable input: MP4/MOV, WITH audio, fps above 30, up to 600 MB,
  4K 120fps max and everything below (tested: 4K120, 4K60, 1080p, 720p).
- The pipeline is LOSSLESS — output quality = input quality. Recommend the
  user record at max phone quality (1080p60 HDR 25–35 Mbps; 4K60 45–80 Mbps).
- 600 MB length caps: ~2.6 min at 30 Mbps, ~2 min at 40 Mbps, ~1.6 min at
  50 Mbps. Cut length, never lower quality.
- The optimized file will NOT play normally in the phone gallery and shows
  no playtime — that is intentional (unknown-duration mvhd), same as
  RTXFury. TikTok Studio accepts it.

## 11. Handoff rule

At the end of every meaningful session: update `HANDOFF.md` and this prompt
(they live in the repo AND at the workspace root), commit, rebuild the
`--all` git bundle, and have the user download it. Record: current branch
and commit, files changed, commands run, validation results, exact known
differences, exact next step, uncommitted files. Never leave the next agent
to infer which branch, file, or experiment is current.
