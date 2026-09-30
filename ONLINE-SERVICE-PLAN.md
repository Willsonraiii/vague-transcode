# Online Optimizer Service — Working Build Plan

## LATEST RESULT — WINDOWS 4K60 REAL VIDEO VALIDATED IN TIKTOK STUDIO (2026-09-30)

USER-CONFIRMED: the third real video (first 4K60) worked in TikTok Studio and HDR is delivered (the project's main target).

### Source (FFprobe, read-only, source untouched)
- Base filename `1790757802960597` (Windows Downloads). 2160x3840 portrait 4K, 60/1 fps, 863 frames, 14.383 s.
- HEVC Main 10, yuv420p10le, BT.2020 / HLG (arib-std-b67), ~84.3 Mbps, video time_base 1/600 (divides 19200).
- Dolby Vision profile 8 (compat id 4) present -> `hdr` mode (DV -> plain HLG).
- AAC-LC 48 kHz stereo, 675 frames. Size 152,074,462 bytes (145.03 MiB).

### Processing (Windows, `online-rtx-service` clone at 87feb10, Node 24.19.0, FFmpeg/FFprobe 9.0.2)
- `node tools/rtx-pipeline.js SRC out\1790757802960597-optimized.mp4`, mode `hdr`.
- Derived: speed x2, video stts `862x640, 1x320`, video elst 28750 ms (mediaTime 0), audio elst 28742 ms (priming 4224), fillers 6075, second track 6750 samples, DV box stripped (1), rebranded.
- Output 152,155,868 bytes (+81,406). Warnings were the two known UNCONFIRMED rules (audio elst = video - 8 ms; filler = 9 x audio samples).
- Validation PASSED: ffprobe (HEVC 2160x3840, 30/1, 863 frames, arib-std-b67, NO DOVI record, two AAC tracks 675 + 6750, duration 28.75) and `ffmpeg -v error -copyts -vsync 0 -i OUT -map 0 -c copy -f null -` printed nothing.

### TikTok result (user-reported)
- HDR: WORKING (user: main target achieved).
- TikTok Studio shows the published duration as ~28-29 s (the x2 track time).
- In the TikTok APP the video plays/shows the normal ORIGINAL duration (~14 s). This answers the earlier open question: the app restores real-time duration.
- Exact HDR-tag wording and visual 4K quality comparison were not itemised by the user beyond "working well".

### Conclusions
- The method is now validated on three real videos, including 4K60 portrait DV profile 8. `--audio-elst-ms` and `--filler-count` overrides were NOT needed.
- The two unconfirmed rules (-8 ms, 10x fillers) have now held on a third source without issue.
- Windows note: no code changes were made in this session; no repository processing code was modified.

### Status / next step
- Deployment is still PAUSED (no-card free host not chosen; Oracle needs a card). Do not alter the validated pipeline to fit a constrained host.
- Resume by either running locally (`npm run start:online`, port 3005) or choosing a host. Do not redo sync or setup research.


## Windows 4K validation continuation — 2026-09-30

A Windows engine is ready at `%USERPROFILE%\Desktop\vague-transcode-4k-test` (`online-rtx-service` 87feb10; Node 24.19.0; FFmpeg/FFprobe 9.0.2). Real Downloads video `1790757802960597.*` is waiting for read-only ffprobe inspection. No optimization has run. Confirm 4K/FPS/HDR/audio/timescale first, then process and perform both mandatory validations. Record the exact TikTok Studio outcome separately; existing 4K60 synthetic/container validation is not a user confirmation for this real file.


## Pause update — 2026-09-30

Implementation is complete on `online-rtx-service`; laptop/GitHub sync completed, but deployment is paused at the user's request. Oracle Always Free was not used because signup requires a supported payment card and the user wants a no-card option. No trusted permanent free no-card host satisfying 600 MB uploads, FFmpeg/Docker, and sufficient RAM was selected. Resume by choosing between a temporary local laptop run and a suitable host; do not alter the validated processing pipeline merely to fit a constrained free platform.


## Target outcome
A private personal website reachable from any device. The browser uploads a video to an online backend, the backend performs the server-side processing, the browser downloads the result, and temporary server files are deleted. The service must not depend on the user's laptop being powered on.

## User workflow
1. Open the hosted website from phone, Windows, Linux, or tablet.
2. Select a video up to approximately 600 MB.
3. Upload begins and a job ID is returned.
4. Server stores the upload in a temporary job directory.
5. A worker runs FFmpeg/remux processing.
6. Browser polls job status or receives progress updates.
7. Browser downloads the finished MP4.
8. Server marks the download successful and deletes original, output, and temporary files.
9. A cleanup task deletes abandoned jobs and failed jobs automatically.
10. User uploads the downloaded MP4 manually to TikTok Studio.

## Proposed architecture

```text
Static web UI
   |
   | HTTPS upload/status/download
   v
API service
   |
   +-- job database/status store
   +-- temporary filesystem or object storage
   +-- processing worker running FFmpeg/remux tools
   +-- cleanup worker
```

For the first deployment, a single Linux VM can run the API, worker, and cleanup process. Separate services are unnecessary until usage grows.

## Initial limits
- Maximum input size: 600 MB.
- One active job per personal account/session initially.
- Limit concurrent jobs to one on a small free VM.
- Do not retain videos after successful download.
- Delete abandoned uploads and outputs after 24 hours, preferably sooner where safe.
- Do not store video backups.
- Use random job directories and non-guessable download tokens.
- Never expose the temporary filesystem directly.

## Security requirements before public deployment
- HTTPS only.
- Authentication or a private access token before exposing the service publicly.
- Validate file size before accepting the upload.
- Store uploads outside the web root.
- Generate random job IDs and download tokens.
- Do not pass user-provided filenames directly into shell commands.
- Use argument arrays/subprocess APIs rather than shell string interpolation.
- Restrict FFmpeg input/output paths to the job directory.
- Rate-limit upload, status, and download endpoints.
- Set server-side request and processing timeouts.
- Delete files on success, failure, cancellation, and timeout.
- Keep logs free of video contents and credentials.
- Add a simple disk-space guard before accepting a job.

## Processing strategy
1. Preserve the current browser project as a reference and fallback.
2. Create a server-side worker with a provider-neutral command interface.
3. First prove reliable upload, queue, processing, download, and cleanup with a known-good FFmpeg operation.
4. Port the timing/remux experiment to the worker only after the basic job lifecycle works.
5. Use the supplied RTXFury metadata and box traces as comparison fixtures.
6. Compare ftyp, mvhd, elst, track count, AAC structure, sample timing, HDR metadata, and DOVI reporting.
7. Test each candidate in Files/Gallery and TikTok Studio.
8. Never call a candidate RTXFury-equivalent based only on ffprobe output.

## Free hosting candidate
Investigate Oracle Cloud Always Free first because it provides a manageable Linux VM and persistent block storage allocation. Verify availability, region capacity, ARM compatibility of the selected tools, identity/payment verification requirements, idle reclamation rules, bandwidth, and current quotas before relying on it. The application must remain deployable to another Linux VPS or cloud provider through Docker/system setup instructions.

Do not assume free-tier hosting means unlimited service. Maintain automatic cleanup and conservative limits even for personal use.

## Deployment shape
- GitHub repository is the source of truth.
- Dockerfile or reproducible install script installs the runtime and FFmpeg.
- `.env.example` documents configuration without secrets.
- Reverse proxy provides HTTPS.
- Process manager or system service restarts the API and worker.
- Health endpoint verifies API and FFmpeg availability.
- Deployment notes record provider, region, VM shape, domain, DNS, TLS, environment variables, and rollback steps without recording secret values.
- Every deployment is tagged or committed.

## Future optional features
- Discord login or a private account system.
- Personal quota and job history without storing video files.
- Progress bars from worker events.
- Cancellation.
- Multiple worker processes if the free tier can support them.
- Paid tiers only if the service later becomes public.

## Rules for future sessions
- If the user says Windows, the repository clone is assumed to be under Desktop.
- If the user says Linux, ask for or use the Linux repository path they provide.
- Do not make speculative MP4 patches.
- Ask before modifying existing processing code unless the user has explicitly approved the specific implementation step.
- Update `HANDOFF.md` and this plan after meaningful work.
- End each session with exact status, files changed, commands run, test results, and the next executable step.
