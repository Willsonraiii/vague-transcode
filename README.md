# Obito Studio (vague-transcode)

> **Lossless 60fps/120fps TikTok Remux & Creator Suite**  
> Preserves source frame rates, Dolby Vision / HDR dynamic range, and cinema timecode without re-encoding a single frame.

**Live Production:** [https://obitostudio.willsonrai.com.np](https://obitostudio.willsonrai.com.np)  
**Production Port:** `3005` (Managed via systemd `obito-studio.service`)

---

## ⚡ What It Solves

When creators upload high-end exports (from DaVinci Resolve, Premiere Pro, or CapCut) to TikTok, the platform’s ingestion pipeline frequently:
1. **Downsamples 60fps / 120fps to 30fps** due to mismatched container clock timescales.
2. **Compresses and desaturates HDR** footage into flat, washed-out grey tones.
3. **Creates micro-stutters and severe periodic buffering** caused by audio/video chunk displacement during CDN HTTP Range streaming.
4. **Hangs on "Processing forever"** when containers have malformed trailing atoms or timeline stretching.

**Obito Studio** fixes the MP4 container before upload using **100% lossless stream copy (`-c copy`)**:
* Video frames and audio streams are **never transcoded or compressed** (100% bit-exact original quality and 60fps fluidity).
* **Zero-Buffering Granular Interleaving**: Interleaves audio and video packets (~6 bytes apart) so TikTok CDN streaming never starves on audio.
* **In-`mdat` Clean Layout**: Encapsulates filler samples strictly inside `mdat` with zero trailing null atoms, preventing TikTok ingestion hangs.
* **1:1 Native Timeline**: Preserves source 60fps timing and duration without 2x timeline distortion.
* Harmonizes container clocks to TikTok's native **19200 timescale base**.
* Injects native **HDR (HLG / PQ)** and Dolby Vision color transfer tags.
* Probes local files and remote TikTok links in **0.05 seconds** with virtually zero RAM usage via HTTP Range header inspection.

---

## 🛠️ System Architecture

* **Frontend (`web/`)**: Modern React 18 SPA built with Vite.
  * **Optimizer**: Drag-and-drop mastering dropzone with real-time terminal output, tactile mode switcher, and fast direct download.
  * **Inspector**: Dual-mode container diagnostics (supports local drag-and-drop files or remote TikTok links via Range probing).
  * **Creator Guide**: Production export cheatsheets for DaVinci Resolve, Premiere Pro, and CapCut.
  * **Library**: Historical mastering records and stream telemetry.
  * **Liquid Glass UI**: Fluid 60fps animations, iOS-style tactile bottom dock with multi-tab sweep gestures, and high-contrast pro hardware aesthetic.
* **Backend (`server-rtx-online.js`)**: Production Express server on Node.js.
  * Manages `/api/optimize`, `/api/inspect`, `/api/inspect-link`, auth, and jobs queue.
  * Integrates `tools/rtx-pipeline.js` for MP4 `stts` sample duration patching and audio `elst` alignment.
  * Integrates `lib/timecode-injector.js` for atom-level timecode synthesis.
  * Uses HTTP Range request probing (`bytes=0-1572863`) to inspect remote links instantly with zero server memory overhead.

---

## 🚀 Quick Start & Development

### 1. Requirements
* **Node.js** v20+ (Node v24 recommended)
* **FFmpeg** & **FFprobe** v6.0+

### 2. Running Locally
```bash
# Install root backend dependencies
npm install

# Install web frontend dependencies
npm --prefix web install

# Build web frontend
npm --prefix web run build

# Start production server on port 3005
PORT=3005 node server-rtx-online.js
```

### 3. Service Management (Production Host)
The production daemon runs under systemd:
```bash
# Check status
systemctl status obito-studio.service

# Hot restart after code updates (service runs with Restart=always)
kill $(pgrep -f "node server-rtx-online.js")
```

---

## 📖 For AI Agents & Contributors

If you are an AI assistant or new developer inspecting this repository, **read [AGENTS.md](file:///home/willson/Desktop/vague-transcode/AGENTS.md) first**. It contains complete architectural rules, user non-negotiables (no AI-style visual tropes, 100% stream copy invariant, zero-RAM probing constraints), and full history.
