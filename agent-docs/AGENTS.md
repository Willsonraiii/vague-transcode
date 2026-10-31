# AGENTS.md — Obito Studio Developer & Agent Knowledge Base

> **CRITICAL INSTRUCTION FOR ALL AI AGENTS**:
> When asked to work on this repository, **read this file completely before touching any code or making proposals**. This document captures the entire architecture, history from day one to the present, production deployment rules, and strict user constraints.

---

## 1. Project Overview & Mission

**Obito Studio** (formerly *vague-transcode*) is a high-performance, studio-grade video mastering and remuxing suite engineered specifically to defeat TikTok's aggressive downsampling and recompression pipeline.

### The Problem It Solves:
1. When creators upload 60fps/120fps or 4K HDR videos to TikTok, TikTok’s server-side ingestion pipeline frequently downsamples them to 30fps, introduces stuttering, drops color transfer tags (making HDR look washed out and grey), or degrades bitrates.
2. Traditional transcoding tools re-encode the video, introducing second-generation compression artifacts, slow rendering times, and cloud server RAM exhaustion.

### The Obito Studio Solution:
* **100% Lossless Stream Copy (`-c copy`)**: Never recompresses video frames or audio samples unless explicitly requested. Every pixel and audio waveform remains bit-for-bit identical to the source.
* **19200 Timescale Harmonization**: Synchronizes MP4 container track clocks (`tkhd`/`mvhd`/`stts`) to TikTok’s native 19200 playback base clock, eliminating micro-stutters and forced server-side frame drops.
* **Dolby Vision & HDR Retagging**: Injects correct color transfer atom metadata (HLG / SMPTE-2084 / BT.2020) so mobile screens display full dynamic range instead of dull, washed-out grey tones.
* **Source-timed MP4 output (validated 2026-10-17)**: Keeps speed factor 1 for video and both AAC tracks, preserving source frame cadence and avoiding the doubled-duration timeline. The code change is pending push/deployment.
* **Zero-RAM Remote Link Probing**: Resolves remote TikTok video streams via upstream CDN extraction and probes only the first ~1.5 MB `moov` header atom using HTTP Range headers (`bytes=0-1572863`). Probing finishes in ~0.05 seconds with negligible memory (~1.5 MB buffer, instantly garbage-collected) and zero cloud RAM spikes.
* **Post to TikTok (Oct 2026)**: Login Kit + Content Posting API integration (`tiktok-routes.js`, `tiktok-store.js`, `lib/tiktok-api.js`, `web/src/TikTokPostSheet.jsx`). Direct Post (`video.publish`) of the optimized master, chunked `FILE_UPLOAD`, status polling, encrypted token store mirrored to a private Gist. The drafts/inbox path (`video.upload`) is implemented but **parked** (scope dropped from `TIKTOK_SCOPES` on 2026-10-16 — see `MIGRATION.md` CURRENT STATUS). UI follows TikTok's UX audit rules (creator nickname, privacy selector with no default, interaction toggles off by default, commercial disclosure, consent text). Status and rules: `MIGRATION.md` CURRENT STATUS, `TIKTOK-UPLOAD-GUIDE.md`, `TIKTOK-PORTAL-SETUP.md`.

---

## 2. Architecture & File Structure

```
/home/willson/Desktop/vague-transcode/
├── server-rtx-online.js     # Production Express server (Port 3005): handles remuxing, inspector, auth, library
├── tools/
│   ├── rtx-pipeline.js      # Lossless remuxing engine (timescale harmonization, stts patching, audio elst)
│   └── (experiment scripts) # Standalone duration/speed tests
├── lib/
│   └── ...                  # Container parsing utilities
├── web/                     # Modern React + Vite frontend SPA
│   ├── src/
│   │   ├── App.jsx          # App shell, tab management, floating dock navigation
│   │   ├── Optimizer.jsx    # Video dropzone, mode switcher, live terminal, download actions
│   │   ├── Inspector.jsx    # Dual-mode inspector (remote TikTok link probe + local drag-and-drop file probe)
│   │   ├── Guide.jsx        # Creator mastering guide (DaVinci, Premiere, CapCut recommended settings)
│   │   ├── Library.jsx      # Historical mastering telemetry and persistent records
│   │   ├── styles.css       # Unified design system: liquid glassmorphism, responsive mobile styling
│   │   └── icons.jsx        # Hand-crafted SVG icon set
│   ├── package.json         # Frontend dependencies (React 18, Vite, Three.js shaders, Lucide)
│   └── vite.config.js       # Vite configuration with production output directed to ../public
├── public/                  # Compiled production static assets served by server-rtx-online.js
├── inspect-tmp/             # Ephemeral temporary directory for fast Range-probed MP4 headers
├── uploads/                 # Ephemeral upload folder for local file processing
└── jobs/                    # Ephemeral output folder for mastered video artifacts
```

---

## 3. Server, Ports & Production Environment

* **Production Port**: `3005` (Bound via `server-rtx-online.js`).
* **Production Service**: Managed via systemd on the host machine:
  ```bash
  systemctl status obito-studio.service
  # To restart after server-rtx-online.js modifications (service runs under user willson with Restart=always):
  kill $(pgrep -f "node server-rtx-online.js")
  ```
* **Production Domain / Funnel**: `https://obitostudio.willsonrai.com.np`
* **Experimental / Part-2 Work**: Runs on port `3006` in `/home/willson/Desktop/part-2`.
  > **STRICT INVARIANT**: **NEVER** touch port `3005` or modify production files when tasked with experimental "Part-2" work.
* **Secondary Clone**: `/home/willson/Desktop/vague-infinity-clone`. Keep this repository synced to `origin/online-rtx-service` whenever changes are committed.

---

## 4. Strict User Rules & Non-Negotiables

Any agent working on this codebase MUST abide by the following user preferences and architectural rules:

### A. Zero "AI-Generated / Vibe-Coded" Aesthetics
The user strongly dislikes and forbids generic AI-style visuals:
* **NO sparkle emojis** (`✨`) anywhere in the application.
* **NO purple-to-blue or rainbow gradient text** (e.g., gradient headers or vibe-coded accents).
* **NO tacky badge pills** (e.g., "CREATOR MASTERCLASS" or "MAGIC AI").
* **Aesthetic Standard**: Strictly clean, professional audio/video studio hardware feel (inspired by Apple hardware, DaVinci Resolve, and high-end cinema tools). High-contrast solid white `#ffffff` headings, subtle sapphire/slate accents.\n* **Liquid-Glass Mandate**: ALL UI work must follow **iOS 26 liquid-glass glassmorphism** — translucent frosted surfaces (`backdrop-blur` + saturation), hairline `rgba(255,255,255,0.15–0.3)` borders, inset specular highlights, rounded geometry and soft depth. No flat opaque cards, no cheap badge pills. When in doubt, reuse the `.liquid-glass-nav` / `.liquid-glass-frame` / `.liquid-glass-chip` material classes in `web/src/styles.css`.

### B. Lossless Container Manipulation Only
* **Do NOT re-encode video frames** unless the user explicitly checks the legacy H.264 re-encode fallback.
* Always preserve `-c copy` stream integrity.
* Maintain 19200 timescale harmonization and accurate color transfer atoms.

### C. Resource Efficiency & Zero Cloud RAM Spikes
* When implementing remote inspection or link scraping, **NEVER** download 50MB+ entire video files into cloud memory.
* Always use **HTTP Range header probing (`bytes=0-1572863`)** to fetch only the faststart `moov` container atom. It executes in 0.05 seconds with negligible RAM usage.

### D. Clean, No-Void Layouts
* Keep the main Optimizer frame well-proportioned and compact.
* Eliminate empty voids or dead space between headers, mode toggles, file choose buttons, and trust rows.
* Ensure segmented mode sliders fit flush with 0 border gaps and zero overlapping border artifacts.

### E. User Communication Style
* **Do NOT write long, bloated essays** with repetitive categories.
* Format responses in **few, clear, detailed, and understandable bullet points**.
* Remember prior user instructions across conversation turns without requiring the user to repeat themselves.

### G. PROTECTED GOLDEN PIPELINE (Zero-Buffering + TikTok Ingestion Pass-Through)
The core TikTok mastering engine is protected by immutable golden backups:
- `tools/rtx-pipeline.js.protected-golden`
- `tools/build-rtx-second-aac.js.protected-golden`

Any modifications to the mastering pipeline must honor these four fundamental rules:
1. **Granular Packet Interleaving (`-max_interleave_delta 0`)**:
   - Places Audio Chunk 0 and Video Chunk 0 adjacent (within ~6 bytes) at the beginning of `mdat` and maintains tight interleaving across the entire file. This eliminates the 2MB audio starvation gaps that cause second-to-second buffering stalls on TikTok CDN HTTP Range streaming.
2. **In-`mdat` Container Encapsulation**:
   - In `tools/build-rtx-second-aac.js`, `mdatBox.size` expands to encapsulate all second track filler samples strictly within `mdat`.
   - Prevents illegal null box headers (`\0\0\0\0` / length 4) that cause TikTok ingestion workers to hang indefinitely on "Processing".
3. **Native 1:1 Cadence Timeline (`speed = 1`)**:
   - Maintains source 60fps frame duration and real audio sample timestamps.
   - Eliminates 2x timeline stretching (`speed = sourceFps / TARGET_FPS`) that triggers TikTok timeline calculation errors.
4. **100% Quality & 10-bit HLG HDR Preservation**:
   - Strict `-c copy` lossless stream copy. Never re-encode 4K HEVC frames.
   - Preserves 2160×3840 native resolution, 60fps fluidity, BT.2020 color primaries, and ARIB-STD-B67 HLG transfer curve.

### H. Strict Experimentation Policy (Cloned Repo Only)
* **Never conduct experiments on this main production branch**: Whenever the user asks to experiment with or prototype new updates (UI redesigns, pipeline adjustments, or architectural features), work MUST be performed **ONLY in a cloned repository** (isolated clone or worktree).
* **Owner permission required for cloning**: If a cloned repository does not already exist, the agent MUST explicitly ask the owner for permission to create/clone one before proceeding. Strict following is required.

### I. Obito Studio Scope Only (Strict)
* **Exclusive Focus**: All development, assistance, analysis, and execution must remain 100% focused on the Obito Studio video mastering application (`vague-transcode`).
* **Zero Cross-Project Contamination**: Never touch, reference, or execute changes for external or unrelated projects. If a prompt mentions unrelated systems or appears mistakenly sent, explicitly clarify and keep Obito Studio untouched.

---

## 5. Build & Deployment Workflow

### 1. Frontend Build:
When modifying files in `web/src/`:
```bash
npm --prefix web run build
```
This compiles the production bundle and writes assets to `public/`.

### 2. Restarting the Production Server:
`server-rtx-online.js` is run by `obito-studio.service` under user `willson`. Because `Restart=always` is configured:
```bash
kill $(pgrep -f "node server-rtx-online.js")
# Wait 3 seconds; systemd automatically spawns the updated server.
```

### 3. Syncing the Clone Repository:
```bash
cp server-rtx-online.js /home/willson/Desktop/vague-infinity-clone/
cp web/src/Guide.jsx /home/willson/Desktop/vague-infinity-clone/web/src/
cp web/src/Inspector.jsx /home/willson/Desktop/vague-infinity-clone/web/src/
cp web/src/Optimizer.jsx /home/willson/Desktop/vague-infinity-clone/web/src/
cp web/src/styles.css /home/willson/Desktop/vague-infinity-clone/web/src/
npm --prefix /home/willson/Desktop/vague-infinity-clone/web run build
```

### 4. Git Version Control:
* Primary development branch: `online-rtx-service`
* Production mirror branch: `main`
* **Before handing anything over**: run the frontend build and confirm it printed `✓ built`; re-check any literal requirement the user stated (character limits, exact quoted strings) in the delivered file. The chat harness grades replies against those literal requirements and can reject the user's turn otherwise.
* When committing and pushing:
  ```bash
  git add -A
  git commit -m "<concise commit message>"
  git push origin online-rtx-service
  git push origin online-rtx-service:main
  ```

---

## 6. Chronological Project Evolution

1. **Phase 1 (Sep 2026 - Browser Remux Prototype)**:
   - Started as a client-side FFmpeg.wasm proof-of-concept for detecting variable frame rates and tagging faststart.
2. **Phase 2 (Late Sep / Oct 2026 - RTX Pipeline & Timescale Discovery)**:
   - Discovered that TikTok's native audio/video clock base is 19200.
   - Built `rtx-pipeline.js`: patched MP4 `stts` sample duration tables, calculated exact audio `elst` priming offsets, injected filler packets, and validated 4K60 HDR footage natively in TikTok Studio.
3. **Phase 3 (Oct 2026 - Production Server & React Studio)**:
   - Deployed Linux host on port 3005 with systemd service `obito-studio.service`.
   - Created a modern React SPA in `web/` featuring fluid liquid-glass bottom dock, multi-tab sweeping, live terminal telemetry, and persistent library.
4. **Phase 4 (Oct 2026 - Timecode Injection & Pro Cinema Standards)**:
   - Historical experiment: timecode injection was tested locally but did not resolve TikTok processing and is not part of the current optimizer output.
5. **Phase 5 (Oct 2026 - Range-Probed Link Inspector & Studio Polish)**:
   - Integrated TikWM upstream stream resolution + HTTP Range `moov` atom probing (`bytes=0-1572863`). Remote TikTok links now display true FPS, resolution, codec, and timescale in <1 second with zero cloud RAM usage.
   - Stripped away all AI-generated tropes, sparkle icons, and gradient text in favor of an Apple/DaVinci studio design system.
6. **Phase 6 (Oct 12–16 2026 - Suga Cloud, members, legal pages, TikTok posting, connected accounts)**:
   - Production moved to Suga Cloud (auto-deploy on push to `online-rtx-service`); members/referrals persisted via Gist; owner/client login; `terms.html` / `privacy.html`; secret-leak cleanup; color presets removed for good.
   - Built and shipped "Post to TikTok" (sandbox credentials): first private Direct Post succeeded 2026-10-16, app review submitted the same day. Drafts parked (portal cannot remove `video.upload`; server requests `user.info.basic,video.publish`). See `MIGRATION.md` CURRENT STATUS for the exact next steps and the lessons (consent-page loop, iPhone handoff, drafts location, Gist mirror).
   - **Connected accounts** (Dashboard): linked TikTok avatar + display name + @handle with Connect / Reconnect / Disconnect (disconnect revokes the grant at TikTok).
