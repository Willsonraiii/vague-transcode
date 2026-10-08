# OBITO STUDIO — The Project Book

Last updated: **2026-10-09**. **Read this file first. Then read COMMANDS.md.** That is all you need to run, maintain, and expand the project without needing AI agents.

Repo: https://github.com/Willsonraiii/vague-transcode — branch `online-rtx-service`.

---

## 1. What This Project Is (In Plain English)

A studio web application that prepares high-framerate (60fps/120fps), HDR (HLG/PQ), and Dolby Vision videos so **TikTok retains native 60fps fluidity and HDR dynamic range** instead of crushing them down into blurry 30fps SDR.

### Core Guarantees:
1. **100% Stream Copy Lossless (Default)**: Container surgery only — zero frame re-encoding, zero bits of quality secretly touched or dropped.
2. **Zero-RAM Disk-Streaming Engine**: Reads only the tiny 100–200 KB `moov` header into memory; streams gigabyte-scale `mdat` payloads straight from disk to disk via 64 KB native streams. Runs comfortably in **< 15 MB RAM** (passes under Suga Cloud’s strict 256 MB free-tier limit).
3. **Resilient Chunked Uploads**: 1 MB slices, 15-second timeouts, idempotent retries (no 409 conflict deadlocks), instant stale socket termination, and disk `truncate()` on dropped packets so zero corrupt bytes ever accumulate.
4. **Color Grade Presets (Optional)**: 6 curated aesthetic looks (Original Lossless, Vibrant Pop, Cinematic Warm, Teal & Orange, Moody Noir, Vintage 35mm). Available both **During** (pre-optimize pass) and **After** (instant post-optimize render on the Done screen without re-uploading).

---

## 2. Environments & Live Deployments

| Environment | URL / Address | Target Port | Engine Role |
| :--- | :--- | :--- | :--- |
| **Suga Cloud (Production)** | `https://obitostudio.willsonrai.com.np` | Cloud Port | Primary public live site (Cloudflare proxy + Suga container) |
| **Linux Laptop (Main Dev)** | `http://192.168.31.181:3005` (Home Wi-Fi) | 3005 | Managed by systemd (`obito-studio.service`) |
| **Tailscale Funnel** | `https://willson-inspiron-15-3552.tail5e494c.ts.net` | 3005 | Encrypted HTTPS remote access from phone |
| **Part-3 Test Clone** | `http://192.168.31.181:3006` / `:8443` | 3006 | Sandbox clone for experimental test runs |

Access token on all local servers: `Willson@007` (or whatever `ACCESS_TOKEN` is set to in environment).

---

## 3. Architecture & File Guide

```text
vague-transcode/
├── lib/
│   ├── stream-remux.js       # Disk-to-disk streaming remuxer (faststart, timescale 19200, DV strip)
│   ├── stream-scanner.js     # Low-memory MP4 box header scanner
│   ├── remux.js              # Pure box helper functions
│   └── color-presets.js      # Color grade catalog (FFmpeg filters + CSS swatches)
├── tools/
│   ├── rtx-pipeline.js       # Master pipeline (timescale + split last stts + dual AAC + optional grade)
│   ├── split-last-stts.js    # Stts split tool with direct disk streaming
│   └── build-rtx-second-aac.js # Dual-track AAC synthesizer with disk streaming
├── server-rtx-online.js      # Production Express server (chunk upload, queue worker, auto-cleaner)
├── web/                      # React 18 + Vite frontend
│   ├── src/
│   │   ├── Optimizer.jsx     # Main studio UI (upload loop, color presets, terminal, downloads)
│   │   ├── Inspector.jsx     # TikTok stream inspector (link-first oEmbed + video prober)
│   │   ├── colorPresets.js   # Client-side color preset definitions
│   │   ├── localProbe.js     # On-device client MP4 parser (detects specs before upload)
│   │   └── styles.css        # iOS liquid glass styling system
├── public/                   # Production build output served by Express
├── jobs/                     # Auto-cleaned temporary processing directories
└── uploads/                  # Auto-cleaned resumable upload binaries
```

---

## 4. Key Systems Explained

### A. Zero-RAM Streaming Remuxing
- **The Problem**: Old `remux.js` allocated 5 buffers in RAM for each video ($74\text{ MB} \times 5 = 370\text{ MB}$), immediately crashing on Suga Cloud’s 256 MB RAM ceiling at 5%.
- **The Solution**: `stream-remux.js` and all subtools now:
  1. Read only the initial `moov` atom (~100 KB) into Node buffer memory.
  2. Rewrite the updated `moov` atom with timescale 19200 and ISO branding directly to the output.
  3. Stream the raw `mdat` block straight through via `createReadStream({ start: mdatStart }).pipe(createWriteStream)`.
  4. Memory never exceeds **15 MB RAM**, allowing videos of 137 MB–600 MB+ to process cleanly.

### B. Resilient Upload Loop (Anti-Freeze)
- **1 MB Chunk Slices**: Optimal packet size over Wi-Fi/Tailscale links.
- **Idempotent Sync**: If a network packet drops and the client retries an offset the server already has, the server returns `{ synced: true, received: st.size }` rather than throwing a blocking `409 Conflict`.
- **Immediate Socket Cleanup**: Incoming chunk requests kill any zombie hanging socket on that upload ID instantly (`prev.req.destroy()`).
- **Disk Truncation on Drop**: If a connection disconnects mid-chunk, `await truncate(p.data, offset)` rolls back partial bytes so zero file corruption occurs.
- **15s Timeout**: Hung connections abort quickly and retry instead of stalling for minutes.

### C. Decimal Byte Display (Apple Files Alignment)
- Apple iOS / macOS Files app measures file sizes in **decimal SI** ($1\text{ MB} = 1,000,000\text{ bytes}$).
- The web app now formats with decimal SI: `fmt = (b) => (b >= 1000000 ? (b / 1000000).toFixed(1) + ' MB' : ...)`
- A $74,457,687\text{ byte}$ video correctly shows as **74.5 MB** on the site (matching your iPhone).

### D. Automated Garbage Collection
- **On Download**: File and upload cache are deleted from disk the moment user download finishes.
- **On Crash / Abandon**: The 60-second sweeper timer deletes any abandoned jobs older than 60 minutes.
- **On Boot**: Server startup scans and wipes any orphaned folders in `/jobs`.

### E. Color Grade Preset System
- **Preset Catalog**:
  1. **Original**: 100% Stream Copy Lossless (zero frame re-encoding, ~3 seconds).
  2. **Vibrant Pop**: Contrast +12%, Saturation +24%, unsharp mask (punchy TikTok feed clarity).
  3. **Cinematic Warm**: Golden film balance, soft lifted shadows.
  4. **Teal & Orange**: Blockbuster contrast with warm skin tones and cyan/teal shadows.
  5. **Moody Noir**: High-contrast desaturated cool blue shadows.
  6. **Vintage 35mm**: Analog pastel curve with gentle faded blacks.
- **Dual Workflows**:
  - *During*: Select on confirm screen -> optimized in one single pass.
  - *After*: Tap any preset pill on the Done screen -> renders via `POST /api/jobs/:id/grade` using the cached master file without re-uploading!

---

## 5. Checking & Running Without AI Agents

### Check Service Health
```bash
curl -s http://127.0.0.1:3005/health
# Response: {"ok":true,"service":"rtx-online",...}
```

### Restart Local System Service (Linux)
```bash
sudo systemctl restart obito-studio.service
journalctl -u obito-studio.service -n 20 --no-pager
```

### Rebuild Frontend After Any Code Changes
```bash
cd ~/Desktop/vague-transcode/web
npm run build
```

### Deploy Updates to Live Suga Cloud
```bash
cd ~/Desktop/vague-transcode
git status
git add -A
git commit -m "update: your changes here"
git push origin online-rtx-service
```
Suga Cloud automatically pulls from `online-rtx-service` and deploys to `https://obitostudio.willsonrai.com.np`.
