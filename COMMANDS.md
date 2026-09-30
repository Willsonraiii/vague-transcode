# COMMANDS - RTX Optimizer quick reference

Everything you need to run the optimizer yourself, with no agent.
Windows first. Linux section at the bottom is a to-do.

Repo (Windows): `%USERPROFILE%\Desktop\vague-transcode-4k-test`   Branch: `online-rtx-service`
Output folder for optimized videos: `Desktop\vague-transcode-4k-test\out\`

---

## 1. Optimize a video (easiest: drag and drop)

Drag the video onto **Optimize Video.bat** on the Desktop. Wait for `COPY TEST: PASS`.
Result: `Desktop\vague-transcode-4k-test\out\<name>-optimized.mp4`

Same thing by command:

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
powershell -ExecutionPolicy Bypass -File .\optimize.ps1 "C:\full\path\to\video.mp4"
```

Keep the source HDR/DV signalling instead (unvalidated on TikTok): add `-Mode standard`.

Good result = `COPY TEST: PASS`, `DV present: False`, `arib-std-b67`, 2 audio tracks.

## 2. Run the web optimizer (localhost)

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
$env:ACCESS_TOKEN = "choose-a-password"
npm run start:online
```

- Open `http://localhost:3005` and type the same password in the token box.
- Keep that PowerShell window open while using it. Stop with Ctrl+C.
- Choose video -> wait for Done -> click **Download optimized MP4** (file = `optimized.mp4` in Downloads).
- The server deletes the temporary files after download or after 1 hour.

Port already in use:

```powershell
netstat -ano | findstr :3005
taskkill /PID <number-from-last-column> /F
```

## 3. Use it from the iPhone (Tailscale, free, no card)

1. Install Tailscale on the PC and on the iPhone, sign in with the SAME account.
2. On the PC: `tailscale ip -4` (gives `100.x.x.x`).
3. Start the server (section 2) and keep the PC on and awake.
4. iPhone Safari: `http://100.x.x.x:3005` -> enter the password.
5. Share -> **Add to Home Screen** to get the app icon.
6. Pick the video from the **Files** app, not Photos (Photos can convert the video).

## 4. Inspect a video before optimizing (read-only)

```powershell
ffprobe -v error -show_entries stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,time_base,bit_rate,nb_frames,sample_rate,channels,color_transfer:stream_side_data -show_entries format=duration,size,format_name -of json "C:\path\to\video.mp4"
```

Accepted: MP4/MOV, has audio, fps above 30, under 600 MB, video time_base denominator divides 19200 (600, 1200, 2400, 4800 are fine).

## 5. Optimize by hand (what the launcher runs)

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
node tools/rtx-pipeline.js "C:\path\to\input.mp4" "C:\path\to\output.mp4"
```

Add `--keep-dv` to keep Dolby Vision (unvalidated). The source file is never modified.

## 6. Validate an output (mandatory)

```powershell
$dst = "C:\path\to\output.mp4"
ffprobe -v error -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,color_transfer:stream_side_data -show_entries format=duration,size -of json "$dst"
ffmpeg -v error -copyts -i "$dst" -map 0 -c copy -fps_mode passthrough -f null -
```

- The ffmpeg line printing NOTHING = pass.
- `-fps_mode` goes AFTER `-c copy` (it is an output option). FFmpeg 9 no longer has `-vsync`.
- Expect: no DOVI record, `arib-std-b67`, 2 audio tracks, video 30/1.

## 7. Back up / update the repo

Save your changes:

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
git status
git add -A
git commit -m "describe the change"
git push origin online-rtx-service
```

Restore a lost file from git: `git checkout -- optimize.ps1` (or any other tracked file).

Get a new update from a bundle sent by the agent (base64 text file in Downloads):

```powershell
cd "$HOME\Desktop\vague-transcode-4k-test"
$t = "$HOME\Downloads\FILE.b64.txt"
$b = "$HOME\Downloads\update.bundle"
[IO.File]::WriteAllBytes($b, [Convert]::FromBase64String((Get-Content $t -Raw).Trim()))
git bundle verify $b
git fetch $b online-rtx-service
git merge --ff-only FETCH_HEAD
git push origin online-rtx-service
```

## 8. Recreate the Desktop launcher if it is lost

`optimize.ps1` lives in the repo folder (restore with `git checkout -- optimize.ps1`). Then:

```powershell
@(
 '@echo off',
 'powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\Desktop\vague-transcode-4k-test\optimize.ps1" "%~1"',
 'echo.',
 'pause'
) | Set-Content -Encoding ASCII "$HOME\Desktop\Optimize Video.bat"
```

## 9. Fresh setup on a new Windows PC

```powershell
git clone -b online-rtx-service https://github.com/Willsonraiii/vague-transcode.git "$HOME\Desktop\vague-transcode-4k-test"
cd "$HOME\Desktop\vague-transcode-4k-test"
npm install
node -v; ffmpeg -version; ffprobe -version
```

Needs Node.js, FFmpeg and FFprobe on PATH (tested: Node v24.19.0, FFmpeg 9.0.2).

## 10. Troubleshooting

- **Cannot scroll in PowerShell:** press Esc (Select mode), or right-click title bar -> Properties -> Layout -> Screen Buffer Height 9999. Or use Windows Terminal.
- **`Unrecognized option 'vsync'`:** use `-fps_mode passthrough` after `-c copy`.
- **`fps_mode cannot be applied to input url`:** the flag is before `-i`; move it after `-c copy`.
- **No Download button:** fixed in commit bc7e665. Update the repo. Workaround: copy `output.mp4` from the newest folder in `jobs\` within 1 hour.
- **Garbled symbols on the page (`a'` `a€"`):** never rewrite a file with `Get-Content | Set-Content`. Restore with `git checkout -- public/index.html`.
- **Pipeline error about timescale:** the video's time base does not divide 19200; that source is not supported yet.
- **Page cannot connect from the phone:** PC asleep/off, server window closed, or Tailscale not connected on both devices.

## 11. Rules to remember

- Never overwrite the source video; outputs go to `out\`.
- Output quality = input quality (no re-encode). Record at the phone's highest quality.
- The optimized file shows no playtime in the phone gallery. That is intentional.
- TikTok success counts only after you confirm it in TikTok Studio. Validated so far: three real videos including a 4K60 portrait DV video (HDR delivered; Studio shows the x2 duration, the TikTok app shows the original duration).
- Do not change tools/ or lib/ (the validated pipeline) without a reason.

## 12. Linux (to do later)

Not set up yet. When on the Linux laptop: `git pull --ff-only origin online-rtx-service`, `npm install`, then ask the agent for the Linux launcher (it needs the same `-fps_mode` fix) and the Tailscale server setup.
