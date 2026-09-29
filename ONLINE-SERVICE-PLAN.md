# Online Optimizer Service — Working Build Plan

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
