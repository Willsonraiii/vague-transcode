# OBITO STUDIO — The Project Book

Last updated: 2026-10-06. **Read this file first. Then read COMMANDS.md.** That is enough to work safely.
Older docs in the repo (`HANDOFF.md`, `NEXT-AGENT-PROMPT.md`, `ONLINE-SERVICE-PLAN.md`) are history logs. Read them only if you need old background. If they disagree with this book, **this book wins**.

Repo: https://github.com/Willsonraiii/vague-transcode — branch `online-rtx-service`.

## 1. What this project is (simple)

A personal web tool that prepares high-fps / HDR phone videos so TikTok keeps the fps and the HDR.
It **repackages** the MP4 — it never re-encodes, so quality stays exactly the source quality.
Validated on 3 real videos, including a 4K60 portrait Dolby Vision clip: HDR confirmed working in TikTok Studio by the user.
It runs on the user's own computers. The phone reaches it through Tailscale (free, no credit card).

## 2. The machines and addresses

| Machine | Role | Repo folder | Node / FFmpeg | Tailscale IP | https address |
|---|---|---|---|---|---|
| Windows desktop `desktop-kndp51g` | current server | `%USERPROFILE%\Desktop\vague-transcode-4k-test` | 24.19 / 9.0.2 | 100.96.112.67 | https://desktop-kndp51g.tail5e494c.ts.net |
| Linux laptop `willson-inspiron-15-3552` | **future main server** | `~/Desktop/vague-transcode` | 24.21 / 6.1.1 | 100.91.23.41 | https://willson-inspiron-15-3552.tail5e494c.ts.net |
| iPhone 12 | client only | — | — | 100.83.123.40 | — |

Both PCs may run the server at the same time — the phone simply opens the URL of the machine that is awake.
Windows terminal = PowerShell 5 (no `&&`). Linux terminal = bash.

## 3. The parts (simple map)

- `tools/rtx-pipeline.js` — the validated engine. **Never change it** without the user's OK.
- `lib/` — engine helpers. **Never change.** (The server must NOT import anything from lib/ for Wi-Fi; the Wi-Fi code lives inline in the server.)
- `server-rtx-online.js` — the web server. Port 3005, binds 0.0.0.0. Has ONE inline `/api/network` route (Wi-Fi name for the menu: Windows `netsh`, macOS `networksetup`, Linux `iwgetid`/`nmcli`). Access key = `ACCESS_TOKEN` env variable.
- `web/` — React UI source (thinking-orbs, bot-avatars, border-beam). `public/` — the built UI the server actually serves. Rebuild with `cd web && npm install && npm run build`.
- UI style (2026-10-02 redesign, v2): scrolling glass landing, macOS/heyclicky vibe. Menu bar = OBITO name (left), **C² living monogram** centered (60px, crosses the bar; S draws→holds→wipes→rests on loop, O breathes with orbiting shine, whole mark sways; cursor tilt; tap = top), and on the **right**: Control Centre (macOS dual-toggle icon; opens a heyclicky-style opaque tile grid: Wi‑Fi + Tailnet tiles, server-network card, brightness & volume sliders, quick-nav tiles to Optimizer/Inspector/How/FAQ; on phones the panel spans the screen) + Wi‑Fi menu + clock. Hero = macOS terminal that types the pitch. Sections unblur on scroll. Dock hidden, wakes near bottom edge, real-mac magnification (mouse + touch). Desktop ≥1080px arranges as a desk: how+FAQ left, Optimizer center, features right, Inspector full width.
- **TikTok Inspector** (section + server endpoints): **link-first** — paste a TikTok link and `POST /api/inspect-link` fetches the creator username via official oEmbed, page metadata (resolution, duration, bitrate, stats), then downloads the stream and probes it for full fps / HDR (HLG/PQ) / Dolby Vision / audio detail. File drop (`POST /api/inspect`) stays as fallback. Everything read-only; files deleted immediately.
- **Check-before-upload** (Optimizer, 2026-10-06): the browser reads the original video's identity **on-device, before anything uploads** (mini MP4/MOV box parser `web/src/localProbe.js`: fps + 1/timescale, resolution, codec, HDR transfer, DV profile, audio tracks, duration, size) and shows it in a macOS-chrome "your video — details" window; only **"Looks right — upload & optimize"** starts the upload (or "Choose another"). After done, an "optimized — details" window lists the output identity above Download / Optimize another (`fps : 60 → 30 for TikTok`). Fallback for unreadable containers: upload first, then server probe (`POST /api/uploads/:id/probe`) with the same confirm screen.
- **Live pipeline terminal** (Optimizer): while a job runs, a mini macOS terminal shows the real server log — source probe line, each repackaging stage (`reading → remuxed → timing → split → audio`), ffmpeg stderr tail, then the copy-test/probe line. Server keeps a 400-line ring buffer per job, exposed as `log` on `/api/jobs/:id`. Honest by design: we never encode, the terminal shows exactly what the server does. It speaks as **OBITO STUDIO server** (`[obito] …` lines) — no third-party optimiser names in the UI (repo/engine file names unchanged for now, rename later).
- **Library window** (section + dock Layers icon): every finished/failed job is appended to `library.json` (metadata only — files still auto-delete after 1 h). Cards show source + output identity tiles (W×H, fps incl. 1/timescale, codec, HDR transfer, DV profile, audio count, duration, size) plus the pipeline summary; counters row on top; Clear button. Endpoints: `GET /api/library`, `POST /api/library/clear`.
- **Menu bar corrected**: the C² logo now floats in an absolutely-positioned wrapper OUT of the bar's grid flow, so the 34 px bar row never stretches — left name / right CC+Wi‑Fi+clock sit perfectly centered inside the bar on every screen; the logo still overhangs downward as designed. On phones the Wi‑Fi menu spans the screen like the Control Centre (no left-edge clip).
- **Access-key lockout**: wrong keys are counted per client; 8 wrong guesses in 10 minutes lock that client out for 10 minutes (429 + Retry-After), so a short key stays safe on a public link.
- `optimize.ps1` + Desktop `Optimize Video.bat` — Windows drag-and-drop optimizer.
- Linux launcher — **not created yet** (COMMANDS.md has the ready paste-block).
- `out/` — outputs. Source videos are never touched or overwritten.

## 4. The user's rules (every agent must keep)

1. Short answers, simple language, key points only. One command block per step. At most one question.
2. Never modify `tools/` or `lib/` without a strong reason and the user's OK.
3. Never overwrite the user's source videos. Outputs go to `out/`.
4. Never claim TikTok success until the user confirms it in TikTok Studio.
5. Mode buttons show only "FPS + Quality + HDR" and "FPS + Quality" — no descriptions, no Dolby text.
6. Flat colors everywhere; gradients only on buttons. Logo = flat planet-ring "O".
7. Free only, no credit card. Tailscale **serve** yes, Tailscale **funnel** no.

## 5. Status — what is done (2026-10-06)

- Pipeline validated (3 real videos, incl. 4K60 HDR). TikTok Studio confirmed HDR.
- macOS-style desktop UI designed, built, pushed to GitHub (`579b989` and later commits).
- The startup crash was fixed and pushed (`ff095ca`): removed two imports of files that never existed, removed two duplicate Wi-Fi routes, kept one working inline route. Server boots clean now.
- Windows firewall rule added (TCP 3005 inbound) — phone can now reach `http://100.96.112.67:3005`.
- `tailscale serve --bg 3005` running on Windows — phone can use the https address.
- Check-before-upload details windows, Library, live pipeline terminal and the access-key lockout are pushed (`59e3649`, 5 Oct). **Windows, Linux and GitHub are all on `59e3649`.**
- Two standalone tools live on the **Windows Desktop** (deliberately NOT in the repo):
  - `check-optimized.mjs` — read-only output checker. Names the variant (RTX x2 timing / timescale method / container-only) and PASS/FAILs the invariants (frame count kept, stts regular, declared fps, timescale 19200, movie 1000, 2 audio tracks). Pure Node, no ffmpeg. Copy to `~/Desktop` on Linux.
  - `optimize-keep-fps.mjs` — lossless remux that leaves the **declared fps alone** (the RTX pipeline halves it on purpose: 60 → 30). `--fps-patch auto` restores the half-fps method when wanted; `--keep-dv` keeps DV. Best run from the repo root (it imports `lib/remux.js`).

## 6. To-do (in order)

1. **Check the fps update actually reached GitHub**: on Linux `git fetch origin` then `git log origin/online-rtx-service..HEAD --oneline` — anything listed is committed but never pushed.
2. **Linux laptop becomes the main server**: pull the repo, `npm install`, start server, `tailscale serve --bg 3005`, create the Linux launcher (COMMANDS.md section L4).
3. **A/B the keep-fps output**: same clip through the normal (half-fps) path and through `optimize-keep-fps.mjs`, post both the same way, compare in "Did it survive?".
4. **Real video test in the new UI** (from the phone: pick from Files app, not Photos), download, post, confirm HDR in TikTok Studio.
5. Optional: remove the Cloudflare analytics script from the unused old root `index.html`.
6. Optional: make the GitHub repo **private** (it is currently public; private is free). Doing so blocks nothing: the user's machines already authenticate, so push/pull keep working; agents simply stop being able to clone anonymously and use prompt C (upload a zip) or a git bundle instead.
7. Future idea: browser-only version for free static hosting (not started).

## 7. Small gotchas to remember

- The access key is **not stored anywhere**. Type it in the terminal each time you start the server (or add it to your profile file — COMMANDS.md shows how). The `.env` file is used only by Docker, not by the normal server.
- Keep the server PC **awake** and the server terminal window open while the phone uses it.
- The two old `*.b64.txt` bundles are outdated backups (GitHub is ahead of them). Safe to keep or delete.
- GitHub shows 7 branches and 0 pull requests. Only `online-rtx-service` is alive; `main` is the old site (default branch, keep). `laptop-uncommitted-backup` and `laptop-prebundle-rtx-backup` contain unique snapshots — keep. The 3 `*-experiment`/`lossless` branches are fully merged old drafts — safe to delete, never required. Pull requests are not used in this solo project and never needed.
- iPhone: use **Safari** for downloads (the Home Screen app cannot download). Pick videos from **Files**, not Photos.
- FFmpeg 9 (Windows) has no `-vsync`: use `-fps_mode passthrough` AFTER `-c copy`. FFmpeg 6.1 (Linux) accepts the same line. The pipeline itself uses neither, so it runs on both.
- Never rewrite repo files with PowerShell `Get-Content | Set-Content` (garbles UTF-8). Use `.NET [IO.File]` or git restore.
- **A bundle merge is not a sync.** After `git fetch <bundle>` + merge on any machine, run `git push origin online-rtx-service` immediately and keep the `.b64` bundle until the push is confirmed on GitHub. What happened once (5 Oct): the Linux merge was never pushed, so Windows could not see it; fixing it needed a force-push on Linux and a `git reset --hard origin/online-rtx-service` on Windows.
- Before assuming work is lost on Windows: `git log -1 --format="%h %s"` and compare with `git ls-remote origin online-rtx-service`. GitHub is the meeting point — a commit that exists only locally on one machine is invisible to the other.
- Windows was moved to GitHub's tip with `git reset --hard` on 2026-10-06 and the working tree was clean before it. Only do that with a clean tree.

## 8. Switching to a new agent (never lose the project)

1. Open a new chat in any agent.
2. Paste the prompt from `MIGRATION-PROMPT.md`.
3. The agent clones the repo (or you upload a zip) and reads this book first.
Everything the agent needs lives in the repo: this book + COMMANDS.md. Your project cannot die with a chat.
