# OBITO STUDIO - migration / handoff (2026-10-02)

Everything a new chat needs to continue. Repo: https://github.com/Willsonraiii/vague-transcode  branch `online-rtx-service`.
Also read, in this order: `NEXT-AGENT-PROMPT.md`, `HANDOFF.md`, `COMMANDS.md`, `ONLINE-SERVICE-PLAN.md`.

## 1. What this project is
A personal online video optimizer for TikTok uploads (the "RTX" method): the validated pipeline `tools/rtx-pipeline.js`
repackages the MP4 (no re-encode) so 60/120 fps clips keep their frame rate and HDR clips stay HDR on TikTok.
Validated on 3 real videos incl. a 4K60 portrait Dolby Vision profile 8 clip (HDR delivered in TikTok Studio;
Studio shows the x2 duration, the TikTok app shows the original duration).
It runs on the user's own computer and is opened from the phone through Tailscale (free, no card).

## 2. Architecture
- `server-rtx-online.js` (Express, port 3005, ACCESS_TOKEN env = access key). Serves `public/` (built front end) and the API.
- API: `POST /api/jobs` (old single upload) | resumable: `POST /api/uploads`, `GET/PUT/DELETE /api/uploads/:id`,
  `POST /api/uploads/:id/start {mode}` -> job | `GET /api/jobs/:id`, `GET /api/jobs/:id/download`, `DELETE /api/jobs/:id`
  | `GET /api/network` (Wi-Fi name of the SERVER computer) | `GET /health`. Modes: `hdr` (default) and `standard`.
- Uploads: 8 MB chunks, pause/resume/cancel keep the partial upload (1 h TTL); the job input is a hard link of the upload,
  so cancelling a job and restarting needs no re-upload. Upload is deleted after the result is downloaded.
- Front end source: `web/` (React 18 + Vite). Build output is committed in `public/`. Rebuild: `cd web && npm install && npm run build`.
  Libraries: `thinking-orbs` (idle/uploading orb), `bot-avatars` (clover: working/paused/done), `border-beam` (beam on the window while busy).
- UI: macOS-style desktop (menu bar, draggable windows with working close/minimize/zoom, dock, Wi-Fi menu). Under 900 px wide it
  switches to a stacked phone layout (dock stays). Flat colours (Vanilla + Cosmic); gradients only on buttons.
- Older files kept but NOT served: root `index.html`, `_style.css`, `privacy.html`, `terms.html` (old Vague Transcode analyzer site).

## 3. Rules the user set (keep them)
- Short answers, key points only (saved preference). Simple language. One command block per step.
- Never modify `tools/` or `lib/` (the validated pipeline) without a strong reason and the user's OK.
- Never modify or overwrite the user's source video. Outputs go to `out/`.
- Never claim a TikTok success until the user confirms it in TikTok Studio.
- Mode buttons show only "FPS + Quality + HDR" and "FPS + Quality", with NO descriptions (no Dolby-conversion text).
- Colours: no gradients except on buttons. Logo = flat planet-ring "O".
- Free, no credit card. Cloud hosts were ruled out (too small / now paid); plan = own computer + Tailscale.

## 4. Environment facts
- Windows PC: PowerShell 5 (no `&&`), repo `%USERPROFILE%\Desktop\vague-transcode-4k-test`, Node 24.19, FFmpeg 9.0.2.
- Linux laptop: bash, repo `~/Desktop/vague-transcode`, Node 24.21, FFmpeg 6.1.1.
- FFmpeg 9: `-vsync` is removed. Validation: `ffmpeg -v error -copyts -i FILE -map 0 -c copy -fps_mode passthrough -f null -`
  (the `-fps_mode` flag goes AFTER `-c copy`).
- Never rewrite a file with `Get-Content | Set-Content` in Windows PowerShell 5 (it garbles UTF-8). Use .NET `[IO.File]` calls.
- Drag-and-drop launchers exist on both machines (`Optimize Video.bat` / `optimize-video`, plus `optimize.ps1` in the repo).
- Safari on iPhone: the Home Screen (PWA) app cannot start a normal download; the user opens the page in Safari instead.
  A fetch-then-share-sheet workaround exists in the code (only used in standalone mode).
- HTTPS for the phone: `tailscale serve --bg 3005` gives `https://<machine>.<tailnet>.ts.net` (private to the tailnet; do NOT use funnel).

## 5. Status
Done and user-confirmed: pipeline validation, local web optimizer, Tailscale, push to GitHub, new design running locally.
Delivered but NOT yet confirmed by the user: this macOS desktop redesign (obito-studio-update.zip) - applied? pushed?
Open items:
1. User applies the update zip, commits and pushes (see COMMANDS.md section 7), then `git pull` on the other machine.
2. Test a real video end to end on the new UI, then from the iPhone in Safari over the Tailscale https address.
3. Check that the Wi-Fi menu shows the server's Wi-Fi name (Windows uses `netsh wlan show interfaces`; Linux `iwgetid`/`nmcli`).
   Browsers cannot read the phone's own Wi-Fi name; the menu says so.
4. Optional: remove the injected Cloudflare analytics script from the old root `index.html` (unused now).
5. Future idea: browser-only version for free static hosting (needs the pipeline ported to the browser; not started).

## 6. Where the history lives
Repo docs (`HANDOFF.md`, `NEXT-AGENT-PROMPT.md`, `COMMANDS.md`) and the user's saved memory notes about this project.
A new chat in the same Claude account can read the memory notes; the code must come from GitHub (clone) or an uploaded zip.
