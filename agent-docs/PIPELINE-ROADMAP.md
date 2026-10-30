# Obito Studio — Pipeline Enhancement Roadmap

Recorded: **2026-10-28**
Context: Lossless 60/120 fps + HDR mastering for TikTok and short-form video.

---

## 1. Buffering & Low-Bandwidth Playback Enhancements (Noted)

### A. Container-Level Bitrate Box (`btrt`) Injection
- **Problem**: Mobile players (iOS AVPlayer, Android ExoPlayer) start playback with conservative buffer allocations when bitrate metadata is absent, causing micro-stutters.
- **Solution**: Inject standard ISO `btrt` box into `stbl/stsd` specifying `bufferSizeDB`, `maxBitrate`, and `avgBitrate`.
- **Impact**: Player pre-allocates optimal memory buffer from frame 0.

### B. Audio Lead-In Cushion (500ms Head Start)
- **Problem**: On slow/jittery connections, frame-by-frame interleaving (`-max_interleave_delta 0`) can cause simultaneous audio/video starvation.
- **Solution**: Position 500ms of audio sample chunks before Video Chunk 0 in `mdat`.
- **Impact**: Audio starts playing instantly; video decoder gains a 500ms safety cushion to catch up without freezing the feed.

### C. Pre-Flight Buffer Risk Scan
- **Problem**: Files with erratic GOP spacing (>2s) or massive peak bitrate spikes (>60 Mbps) buffer on weak mobile connections regardless of container health.
- **Solution**: Client-side / server pre-flight probe detecting GOP distance, VBV compliance, and bitrate variance with clear warning indicators.

---

## 2. New Pipeline Feature Candidates

### A. Multi-Platform Container Mastering (Instagram Reels & YouTube Shorts)
- **Reels Engine**: Reels enforces strict color matrix requirements and strips HDR if `colr` atoms are missing or non-standard. A specialized Reels remux pass harmonizes QuickTime vs MP4 atoms.
- **YouTube Shorts Engine**: Optimized VP9/HEVC container structure with ISO-639-2 language tags and chunk alignment tailored to YouTube's ingestion edge.

### B. Lossless Color Tag Harmonizer (`colr` / `nclx`)
- **Problem**: Different NLEs (DaVinci, Premiere, CapCut) export conflicting color tags (e.g. QuickTime `prof` vs ISO `nclx`, or mismatched transfer curves: HLG `9-16-9` vs `9-18-9`).
- **Solution**: A pure container surgery pass that normalizes color atom tags so Apple devices and TikTok never misidentify HDR as washed-out SDR.

### C. Audio Loudness & Phase Inspector (-14 LUFS Sweet Spot)
- **Problem**: TikTok normalizes audio to -14 LUFS. Clips at -8 LUFS are heavily compressed/distorted by TikTok's limiter; clips at -24 LUFS sound muffled.
- **Solution**: Fast probe checking integrated LUFS and stereo phase correlation, alerting creator to volume issues before publishing.

### D. Smart Repair Engine for Variable Frame Rate (VFR) Sources
- **Problem**: Phone recordings or screen captures with erratic VFR cannot be stream-copied losslessly into 19200 timescale.
- **Solution**: A secondary fallback pipeline: high-efficiency, visually lossless 10-bit HLG repair pass that normalizes VFR into constant 60fps 19200 cadence.

---

## 3. Competitive Moats vs. Competitors (TikHaze, CapCut, etc.)

### A. True Lossless Proof (Bitstream Telemetry Badge)
- Competitors quietly re-encode videos in cloud queues, degrading micro-contrast and adding generation loss.
- Obito proves `-c copy`: 100% pixel fidelity, exact frame retention (e.g. 863/863 frames), zero re-encode artifacts, native 10-bit HLG untouched.

### B. Instant On-Device Client Probing (Zero-Upload Waste)
- Competitors require uploading 200MB+ before failing or showing stats.
- Obito probes timescale, codec, HDR, and bitrate client-side in milliseconds before sending bytes over the wire.

### C. Drift-Free Audio Priming & Harmonized Clocks
- Handles exact `elst` priming (-8ms gap) and 19200 timescale synchronization so audio never drifts out of sync on TikTok.

### D. Direct Post API Integration
- One-click publishing straight from the mastering completion view directly to TikTok via Content Posting API without opening secondary file pickers.
