# Continuation Prompt — Vague / RTXFury-Style Online Optimizer

Copy the text below into a new chat or give it to another agent. The agent must read
this file, `HANDOFF.md`, and `ONLINE-SERVICE-PLAN.md` before changing code.

---

## Role and instruction

Continue the Vague Transcode project from the existing repository history. Do not
restart the history, do not repeat already-failed browser-only experiments, and do
not blindly patch MP4 metadata. The project is trying to build an online personal
video optimizer that follows the observed RTXFury workflow and output as closely as
technically possible.

Before making any repository or processing-code change, state the exact change and
wait for confirmation unless the user has explicitly approved that implementation
step. Keep all experiments isolated in branches. Never claim TikTok success without
TikTok Studio validation.

**Environment note (2026-09-29 session):** the second-AAC-track experiment was
implemented and validated in an Arena sandbox clone of the GitHub repo
(`/home/user/vague-transcode`, branch `rtx-audio-track-experiment`, commit
`ff9a716`). The sandbox has no GitHub credentials, so the commit exists there and
as `/home/user/rtx-work/0001-Add-RTXFury-second-AAC-track-experiment-tool.patch`
plus `/home/user/rtx-work/rtx-audio-track-experiment.bundle`. To land it on the
user's Linux laptop, either apply the patch / fetch the bundle there, or re-run the
same steps. The tool file itself is `tools/build-rtx-second-aac.js` (new file only;
no existing code was modified).

## User's final objective

Build a cloud-hosted personal web service usable from any device, especially a phone:

```text
Phone / any browser
        ↓ upload video
Online processing server
        ↓ server-side lossless MP4/timing/container processing
Temporary output
        ↓ browser downloads result
User uploads downloaded MP4 to TikTok Studio
        ↓
Server deletes temporary files
```

The user's Linux laptop is for development and deployment only. The finished service
must not depend on the laptop staying powered on. The user does not intend to sell
the service; personal use is the target. A free cloud tier is preferred. Maximum
input size is approximately 600 MB per video.

Temporary-storage policy:
- Store original and output only while a job is active or awaiting download.
- Delete successful originals and outputs after download.
- Delete failed, cancelled, and abandoned jobs automatically.
- Do not keep a permanent video archive.

## Website/workflow being followed

The reference site is RTXFury (`rtxfury.xyz`), not Vague's old browser-only
implementation. RTXFury is treated as the behavioral and structural reference
because its website shows an optimization stage, account/tier-based upload limits,
and an upload → backend processing → download workflow.

The browser is only the client interface. RTXFury's processing is treated as
server-side/backend processing. Our intended equivalent is an online cloud backend,
not an offline laptop-only server.

RTXFury workflow to follow:

```text
Browser selects/upload video
        ↓
RTXFury backend processes/remuxes it
        ↓
Browser downloads optimized MP4
        ↓
User uploads MP4 to TikTok
```

Our service should provide the same user workflow, but use our own server-side
pipeline. Do not claim that the private RTXFury algorithm has been fully reproduced
until a generated file is compared and tested in TikTok Studio.

## Repository/platform rules

- When the user says Windows, assume the clone is on the Desktop unless they provide
  another path.
- On the user's Linux machine, the active clone is:

```text
/home/willson/Desktop/vague-transcode
```

- An old Downloads clone was deleted. Do not create another clone unless requested.
- Use the Linux Desktop clone only (on the laptop). In the Arena sandbox the clone
  is `/home/user/vague-transcode` (cloned from GitHub; all four branches present).
- The GitHub repository is:

```text
https://github.com/Willsonraiii/vague-transcode.git
```

- User is authenticated with GitHub locally (on the laptop) and can push. Do not ask
  for or use a pasted token.
- Keep migration/handoff files updated after meaningful work.
- Keep backups in Git branches and GitHub. Do not merge experimental pull requests
  into `main` until validation is complete.

## Branches and current position

```text
main                        e3ca2c3  Preserve RTX edit-list timing structure
online-server-lossless      c075f11  Fix composition offsets in RTXFury timing experiment
rtx-final-sample-experiment 6c5002b  Match RTXFury movie timescale and edit durations
rtx-audio-track-experiment  ff9a716  Add RTXFury second-AAC-track experiment tool   <-- current work
                            (was 6c5002b before the 2026-09-29 session)
```

On the laptop the branch may still be at `6c5002b` until the patch/bundle is
applied and pushed. Do not delete branches. Do not merge PRs yet.

First commands in a new session (laptop):

```bash
cd "$HOME/Desktop/vague-transcode"
git status --short --branch
git branch -vv
git log --oneline --decorate --graph --all -20
ls -l tools lib/rtx* server-rtx* 2>/dev/null
ls -lh /home/willson/Downloads/rtxfury-matching-1790458373247510.mp4
```

## Files in the repository / project

```text
index.html
lib/remux.js            lib/wasm-encode.js    lib/probe.js        lib/hdr-doctor.js
server-transcode.js     server-lossless.js    server-rtx-experiment.js
server-rtx-duration-experiment.js
lib/rtx-duration.js     lib/rtx-edit.js
tools/split-last-stts.js
tools/patch-rtx-movie-time.js
tools/build-rtx-second-aac.js        <-- second AAC track (v2: 7056364..7c0d45b)
tools/rtx-pipeline.js                <-- generic one-command pipeline (2bba639)
Dockerfile  package.json  package-lock.json  SETUP.md  README.md
```

Workspace-only helpers from the sandbox session (not in the repo):
`/home/user/rtx-work/run-stage1.mjs` (stage-1 driver: remux+duration+edit),
`/home/user/rtx-work/dump-boxes.py` (MP4 box dumper),
`/home/user/rtx-work/validation-log.md` (full session log),
`/home/user/rtx-work/synthetic-source.mp4` (synthetic stand-in source).

## Existing server paths and their meaning

- `server-transcode.js` — old Dolby Vision re-encode server. Leave intact.
- `server-lossless.js` — working baseline server on port 3002 (options
  `stripEdits:false, stripDV:false, zeroDuration:false, rebrand:false`).
  Baseline; must not be broken.
- `server-rtx-experiment.js` — 1/19200 timing experiment on port 3003
  (isoSignature via the browser remux module).
- `server-rtx-duration-experiment.js` — timing-chain experiment server on port
  3004: faststartRemux(isoSignature) + applyRtxDurationExperiment +
  patchVideoEditList(20, 1280).

## Source/reference media used on Linux

```text
/home/willson/Downloads/1790458373247510.MP4                 (valid source)
/home/willson/Downloads/rtxfury-matching-1790458373247510.mp4 (RTXFury reference)
```

Source characteristics: 600 HEVC Main 10 frames, video timescale 1/600, stts
600x10, duration 10.000000 s, AAC 471 samples, sample duration 1024 at 1/48000
(last sample partial — see expected tool output below), audio priming 2112
(elst media_time 2112 -> 4224 after x2).

Old invalid files (do not use as inputs): `1790458373247510-vague.mp4`,
`1790458373247510-patched.mp4`.

## Exact matching RTXFury output facts (reference target)

```text
Video: HEVC Main 10, 600 frames, 1/19200, 19.983333 s, ~30.03 FPS, ~15.36 Mbps
Audio 1: AAC, 1/48000, 471 frames, 19.976000 s, ~128 kbps, starts DTS -4224,
         carries AAC skip-samples side data, stts 470x2048 + 1x512
Audio 2: AAC, 1/48000, 4710 frames, 19.976000 s, ~142 kbps, starts DTS 0,
         no skip-samples side data, stts 470x2048 + 1x512 + 4239x1,
         samples 471-4709 are 8 bytes each, payload 0000000400000000
elst: video (19984, 1280); audio1 (19976, 4224); audio2 (19976, 4224)
movie timescale 1000; video media timescale 19200; audio media timescale 48000
metadata: major_brand isom, compatible isomiso2mp41,
encoder "RTX Fury Quality Method - https://www.rtxfury.xyz/ - v21.2 [src 60fps x2]"
```

The first 471 audio packet sizes/durations match between the two audio tracks, but
timing metadata differs (start DTS, skip-samples side data).

Additional user observations (2026-09-29, see HANDOFF.md for detail):
1. RTXFury's flow appears to upload the user's video to their own backend /
   remote processor and re-download it before offering the result — consistent
   with the planned job/worker architecture.
2. The final file is roughly 0.5 MB larger than the input — consistent with
   the duplicated audio track + fillers + moov growth (the ~128/~142 kbps
   reference bitrates imply a ~320 KB audio payload; 320 KB + 4239×8 B over
   19.976 s ≈ 141.6 kbps). Verify: reference size − source size, and the
   tool's outputBytes − inputBytes on the real run.
3. Videos without audio CANNOT be optimized — the audio track is load-bearing
   for the bypass. Keep rejecting audio-less inputs in the pipeline.

## Validated video experiment results (unchanged)

The final-sample splitter + movie-time patch produced (validated previously and
re-confirmed on the synthetic stand-in in the 2026-09-29 session):

```text
video r_frame_rate 30/1, avg_frame_rate 36000/1199, timebase 1/19200,
duration_ts 383680, duration 19.983333, 600 frames, stts 599x640 + 1x320,
movie timescale 1000, video elst (19984, 1280), audio elst (19976, 4224)
```

The movie-time patched output passed `ffmpeg -v error -copyts -vsync 0 -i FILE
-map 0 -c copy -f null -` with no output.

## 2026-09-29 session — second AAC track: real-file run + reference-matched v2

Timeline: v1 tool (commit ff9a716, sandbox) was installed and run on the REAL
source via laptop kit v1 (laptop commit 8012409). The real run + reference box
dump then DISPROVED two assumptions (track 2 elst; ctts theory) and revealed
the exact reference construction. Tool v2 (commits 7056364 + 2092c92, sandbox)
implements the measured construction and is embedded in kit v2
(sha256 ac3abe74...). Kit v2 self-updates the tool on the laptop and re-runs.

Measured reference facts (supersede earlier assumptions):
- Source audio: 471 samples, stts uniform 471x1024, 19 chunks, priming elst.
- Track 1: stts 470x2048 + 1x512 — final sample TRIMMED so media ends exactly
  at the edit end (4224 + 19976ms x 48 = 963072); re-chunked stsc [(1,1),(470,2)]
  with 470 one-sample chunk offsets; sgpd/sbgp kept; DTS -4224 + skip 4224.
- Track 2: NO elst, NO ctts (plain track: DTS 0, pts == dts, 2048 durations,
  all 4710 packets); stts 470x2048 + 1x512 + 4239x1; stsc [(1,1),(470,2),
  (471,4239)]; stco 471 entries with the first 470 SHARED with track 1 (no
  duplicated payload); mdhd 958848 (edit ticks); tkhd 19976; sgpd/sbgp kept.
- Fillers (4239 x 0000000400000000) appended at EOF OUTSIDE the declared mdat.
- Reference growth over source: 61,107 bytes (not 0.5 MB).
- Reference container: ftyp isom/isomiso2mp41 28B + free 8B, mvhd v1 120B,
  encoder tag; reference is fully re-interleaved (audio packet-per-chunk).

v2 tool validation (synthetic): track 2 packets 0/0/2048, all samples present,
duration 19.976, copyts PASS; decode errors only from fillers (expected; the
reference decodes identically — kit v2 prints both error counts).

Immediate next step: re-run kit v2 on the laptop, paste the report, answer the
remaining open questions (track 1 mdhd duration; mvhd v1 duration/next_track_id
— kit v1's dumper had wrong v1 offsets, fixed in v2), then push the branch.
No PR merges. No TikTok claims until TikTok Studio validation.

## What remains to do

### 1. Validate the second AAC track on the REAL files (immediate next task)

The user runs this on the Linux laptop with `/home/user/rtx-work/laptop-runbook.sh`
(download the runbook, `dump-boxes.py`, and the patch or tool file from the
workspace). It performs all of the following automatically and writes
`/tmp/vague-audio-experiment-report.txt` to paste back:

On the laptop (or by uploading the two files to the sandbox):
1. Run the full chain on `/home/willson/Downloads/1790458373247510.MP4`:

```bash
node server-rtx-duration-experiment.js &   # or the run-stage1.mjs driver
# upload/download via the server, or call the libs directly, then:
node tools/split-last-stts.js  STAGE1.mp4  /tmp/vague-rtx-final-sample-experiment.mp4
node tools/patch-rtx-movie-time.js /tmp/vague-rtx-final-sample-experiment.mp4 \
  /tmp/vague-rtx-movie-time-experiment.mp4
node tools/build-rtx-second-aac.js /tmp/vague-rtx-movie-time-experiment.mp4 \
  /tmp/vague-rtx-audio-track-experiment.mp4
```

2. Check the tool's JSON matches the assertions above.
3. ffprobe both audio streams of the output AND of the RTXFury reference
   (`rtxfury-matching-1790458373247510.mp4`); compare first-packet DTS, side
   data, packet durations, nb_frames, durations.
4. Box-dump reference track 2 and answer the open questions:
   - does reference track 2 have ctts? (our default assumes yes)
   - reference track 2 packet durations in ffprobe: 2048 or 1024-style?
   - are track 2's first 471 chunk offsets shared with track 1 or duplicated?
   - does reference track 2 keep sgpd/sbgp? (we drop them)
   - reference track 2 stsc layout (we write one chunk of all 4710 samples)
5. Run `ffmpeg -v error -copyts -vsync 0 -i OUT.mp4 -map 0 -c copy -f null -`
   and a full decode test.
6. Only then: Files/Gallery playback test and TikTok Studio upload. Record the
   exact result in HANDOFF.md. Do not claim success before TikTok confirms.

### 2. Implement generic timing

The experiment tools still hardcode reference-specific values (19984/19976/1280/
4224/4239; build-rtx-second-aac.js derives everything else from the input but
trusts the input elst media_time). The production algorithm must read per-input
mdhd/stts/ctts/frame counts/movie timescale, derive the media_time from source
priming, compute target timing per input, and validate 60 FPS and 120 FPS
separately.

### 3. Match remaining container structure

- RTXFury `mvhd` version 1 / 120-byte vs our version 0 / 108-byte.
- Exact `ftyp` size/brand layout; remove `dby1` by rebuilding/shrinking ftyp.
- Ensure no accidental DOVI metadata destruction; determine why RTXFury's
  ffprobe no longer reports the source DOVI configuration record.

### 4. Integrate server pipeline (after audio + container experiments are valid)

One final server-only pipeline; keep baseline and experiments available; API job
lifecycle, progress, cancellation/timeout, cleanup; mobile browser UI; 600 MB
limit; HTTPS/private access before public exposure.

### 5. Deploy online (Oracle Always Free investigated first; provider-neutral
via Docker; do not use the laptop as the production server).

### 6. Validate TikTok (for every claimed final version: ffprobe + packet timing
+ Files/Gallery + TikTok Studio; record exact results in HANDOFF.md).

## Important failed approaches (do not repeat)

- FFmpeg `-itsscale` plus a one-tick/`00:00` duration patch (worse FPS/quality).
- Browser-only WASM remux as if it were equivalent to RTXFury's backend.
- `stripEdits:true` for the RTXFury output; RTXFury retains edit lists.
- Simple four-byte `dby1` replacement; RTXFury's ftyp is smaller and requires box
  rebuilding.
- Treating `00:00` as the whole method.
- Duplicating AAC tracks without matching sample tables and offsets.
- Claiming Dolby Vision preservation solely because the source contains DOVI.
- Claiming TikTok success without TikTok Studio validation.

## Handoff rule

At the end of every meaningful session:

```bash
git status --short --branch
git log -1 --oneline
git push
```

Update `HANDOFF.md` and this continuation prompt with: current branch and commit,
files changed, commands run, validation results, exact known differences, exact
next step, and any uncommitted files. Never leave the next agent to infer which
branch, file, or experiment is current.
