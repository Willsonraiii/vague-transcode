# Vague Transcode

A browser tool that checks a video before you upload it to TikTok, and fixes the
container losslessly.

**Live:** https://YOURNAME.github.io/vague-transcode/

## What it does

- Reads resolution, frame rate, codec, bit depth and colour metadata from the file
- Detects variable frame rate — the most common reason a 60 fps export is delivered at 30
- Reads HDR colour tags and Dolby Vision metadata
- Flags files damaged by a lossy phone-to-PC transfer
- Fixes the MP4 container (faststart) without re-encoding a single frame

Everything runs in the browser. No server, no upload, no account, no analytics.

## Honest note

Every social platform re-encodes every upload. TikTok delivers around 1080p at
2–2.5 Mbps regardless of what you send. This tool improves the source their
encoder works from and makes sure your frame rate and colour survive — it does
not prevent their compression, and nothing can.

## Files

```
index.html      the tool
privacy.html    privacy policy
terms.html      terms of service
_style.css      styles
lib/            probe, diagnosis, planning and remux modules (ES modules)
```

Static site. No build step.
