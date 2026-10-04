# COMMANDS — every terminal thing, both machines

Windows = PowerShell 5 (no `&&` — run lines one by one). Linux = bash.
Repo folders: Windows `%USERPROFILE%\Desktop\vague-transcode-4k-test` · Linux `~/Desktop/vague-transcode`.
Output folder on both: `out/` inside the repo. Source videos are never touched.

---

# W — WINDOWS

## W1. Optimize a video (drag and drop)
Drag the video onto **Optimize Video.bat** on the Desktop. Wait for `COPY TEST: PASS`.
Result: `...\vague-transcode-4k-test\out\<name>-optimized.mp4`.

Same thing by command:

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
powershell -ExecutionPolicy Bypass -File .\optimize.ps1 "C:\full\path\to\video.mp4"
```

Keep the source HDR/DV signalling instead (unvalidated): add `-Mode standard`.

## W2. Run the web server (the website)

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
$env:ACCESS_TOKEN = "your-key"
npm run start:online
```

Open `http://localhost:3005`, type the same key. Keep this window open. Stop with Ctrl+C.
(Optional comfort: put the key in your PowerShell profile so you never type it — see W9.)

## W3. Phone by http (Tailscale IP)

```powershell
tailscale ip -4
```

Phone Safari: `http://<that-ip>:3005`. If it times out, the firewall rule is missing (W5).

## W4. Phone by https (the protected address)

```powershell
tailscale serve --bg 3005
```

It prints your address (on this PC: `https://desktop-kndp51g.tail5e494c.ts.net`). Runs in background, survives closing the window. To stop: `tailscale serve --https=443 off`. To see it again: `tailscale serve status`.

## W5. Firewall rule (only needed once per PC — already done on this PC 2026-10-02)
Admin PowerShell:

```powershell
New-NetFirewallRule -DisplayName "OBITO STUDIO 3005" -Direction Inbound -Protocol TCP -LocalPort 3005 -Action Allow
```

## W6. Port 3005 already in use

```powershell
netstat -ano | findstr :3005
taskkill /PID <number-from-last-column> /F
```

## W7. Validate an output (what "good" means)

```powershell
$dst = "C:\path\to\output.mp4"
ffprobe -v error -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,color_transfer:stream_side_data -show_entries format=duration,size -of json "$dst"
ffmpeg -v error -copyts -i "$dst" -map 0 -c copy -fps_mode passthrough -f null -
```

Good = `COPY TEST: PASS` (the ffmpeg line prints nothing), no DOVI record, `arib-std-b67`, 2 audio tracks, video 30/1. `-fps_mode` goes AFTER `-c copy`.

## W8. Save / update the code (git)

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
git status
git add -A
git commit -m "describe the change"
git push origin online-rtx-service
```

Get updates on this PC: `git pull --ff-only origin online-rtx-service`.
Restore a lost tracked file: `git checkout -- optimize.ps1`.

## W9. Never type the key again (optional)

```powershell
notepad $PROFILE
```

Add the line `$env:ACCESS_TOKEN = "your-key"`, save, restart PowerShell. (Only do this on your own PC.)

## W10. Recreate the Desktop launcher if lost

```powershell
@(
 '@echo off',
 'powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\Desktop\vague-transcode-4k-test\optimize.ps1" "%~1"',
 'echo.',
 'pause'
) | Set-Content -Encoding ASCII "$HOME\Desktop\Optimize Video.bat"
```

---

# L — LINUX (the future main server)

## L1. First-time / keep-up-to-date

```bash
cd ~/Desktop/vague-transcode
git pull --ff-only origin online-rtx-service
npm install
node -v; ffmpeg -version | head -1
```

(If the repo is not there yet: `git clone -b online-rtx-service https://github.com/Willsonraiii/vague-transcode.git ~/Desktop/vague-transcode` first.)

## L2. Run the web server

```bash
cd ~/Desktop/vague-transcode
ACCESS_TOKEN="your-key" npm run start:online
```

Open `http://localhost:3005` on the laptop, or from the phone: `http://100.91.23.41:3005`.
Linux has no blocking firewall by default; if the phone times out, check `sudo ufw status` and allow 3005 if active.

## L3. Phone by https

```bash
tailscale serve --bg 3005
```

Address: `https://willson-inspiron-15-3552.tail5e494c.ts.net`. Status: `tailscale serve status`. Stop: `tailscale serve --https=443 off`.

## L4. Create the Linux drag-and-drop launcher (one-time)
This is the Linux cousin of `Optimize Video.bat`, with the same safety checks style and the `-fps_mode` copy test:

```bash
cd ~/Desktop/vague-transcode
cat > optimize-video <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ $# -ge 1 ] || { echo "Usage: optimize-video VIDEO [hdr|standard]"; exit 1; }
repo="$HOME/Desktop/vague-transcode"
src="$(readlink -f "$1")"; mode="${2:-hdr}"
mkdir -p "$repo/out"
dst="$repo/out/$(basename "${src%.*}")-optimized.mp4"
[ "$src" != "$dst" ] || { echo "Output would overwrite the source"; exit 1; }
cd "$repo"
if [ "$mode" = standard ]; then node tools/rtx-pipeline.js "$src" "$dst" --keep-dv; else node tools/rtx-pipeline.js "$src" "$dst"; fi
echo "--- validate ---"
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,color_transfer -show_entries format=duration,size -of json "$dst"
if [ -z "$(ffmpeg -v error -copyts -i "$dst" -map 0 -c copy -fps_mode passthrough -f null - 2>&1)" ]; then
  echo "COPY TEST: PASS"; else echo "COPY TEST: FAIL"; fi
echo "FILE: $dst"
EOF
chmod +x optimize-video
git add optimize-video
git commit -m "Add Linux launcher optimize-video"
git push origin online-rtx-service
```

Use it: `~/Desktop/vague-transcode/optimize-video "/path/to/video.mp4"` (or `nautilus .` and double-click via "Run in Terminal").

## L5. Port 3005 already in use

```bash
ss -tlnp | grep 3005
kill <pid>
```

## L6. Validate an output

```bash
dst="/path/to/output.mp4"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,color_transfer:stream_side_data -show_entries format=duration,size -of json "$dst"
ffmpeg -v error -copyts -i "$dst" -map 0 -c copy -fps_mode passthrough -f null -
```

Same "good" rules as Windows (W7).

## L7. Save / update the code (git)

```bash
cd ~/Desktop/vague-transcode
git add -A
git commit -m "describe the change"
git push origin online-rtx-service
```

## L8. Never type the key again (optional)

```bash
echo 'export ACCESS_TOKEN="your-key"' >> ~/.bashrc
source ~/.bashrc
```

---

# P — PHONE (no terminal, just the steps)

1. Safari → the https address of the awake PC → type the key.
2. Choose mode → **Choose video** → pick from the **Files** app (not Photos).
3. Wait for Done → **Download optimized MP4**.
4. Post to TikTok → confirm HDR in **TikTok Studio**. Only that counts as success.
5. Optional: Share → Add to Home Screen for the app icon (downloads must still happen in Safari).

---

# T — TROUBLESHOOTING

- **Server won't start, "Cannot find module .../lib/..."** — that was the 2026-10-02 bug; fixed in commit `ff095ca`. If you ever see it again, your copy is old: `git pull --ff-only`.
- **Phone times out, localhost works** — firewall (W5) or PC asleep or server window closed or Tailscale off on one side.
- **`Unrecognized option 'vsync'`** — FFmpeg 9: use `-fps_mode passthrough` AFTER `-c copy`.
- **Garbled symbols on the page** — someone rewrote a file with `Get-Content | Set-Content`. Fix: `git checkout -- public/index.html`.
- **No Download button** — old code; update the repo (fixed long ago in `bc7e665`).
- **https address dead** — serve stopped: run `tailscale serve --bg 3005` again on that PC.
- **Pipeline error about timescale** — that source's time base does not divide 19200; not supported yet.
- **WiFi menu shows no name** — the PC has no Wi-Fi (it will say "connected by cable") or the tools are missing; on Linux it tries `iwgetid` then `nmcli`.

## 13. Run permanently on Linux (systemd + Tailscale)

Stop any hand-started server first (Ctrl+C), then install the service once:

```bash
cd ~/Desktop/vague-transcode
NODE=$(which node)
sudo tee /etc/systemd/system/obito-studio.service >/dev/null <<EOF
[Unit]
Description=OBITO STUDIO optimizer
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/Desktop/vague-transcode
Environment=ACCESS_TOKEN=obito
Environment=PORT=3005
Environment=PATH=$PATH
ExecStart=$NODE server-rtx-online.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now obito-studio
sudo systemctl status obito-studio --no-pager | head -8
```

Keep Tailscale on and shared (once):

```bash
sudo systemctl enable --now tailscaled
sudo tailscale up
sudo tailscale serve --bg 3005      # private https://<machine>.<tailnet>.ts.net
```

Stop the laptop sleeping (the phone cannot reach a sleeping laptop):

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# undo: sudo systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

Controls:

- Status: `sudo systemctl status obito-studio`
- Stop for now: `sudo systemctl stop obito-studio`
- Start again: `sudo systemctl start obito-studio`
- Disable for good: `sudo systemctl disable --now obito-studio`
- Tailscale sharing off: `sudo tailscale serve reset`
- After a code update: `git pull && sudo systemctl restart obito-studio`
- Logs: `journalctl -u obito-studio -f`
- Change the key: `sudo nano /etc/systemd/system/obito-studio.service`, then `sudo systemctl daemon-reload && sudo systemctl restart obito-studio`
