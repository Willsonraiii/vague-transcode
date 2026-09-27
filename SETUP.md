# Obi transcode server — easiest setup

> **Optional.** The site works fully without this — container fixes and the
> 10-bit/HDR re-encode both run without a server (see `index.html`'s
> "Download re-encode script" button). Only set this up if you specifically
> need to preserve Dolby Vision RPU while changing fps/bitrate/scale.

Everything (ffmpeg, dovi_tool, node) is baked into one Dockerfile, so you
never have to install anything manually on the server itself — the
Dockerfile does the exact steps you already ran on Mint, automatically,
at build time.

## Easiest path: Fly.io (free tier, one command deploy)

**1. Install the Fly CLI (one time, on your Mint machine):**
```bash
curl -L https://fly.io/install.sh | sh
```
Restart your terminal or `source ~/.bashrc` after.

**2. Sign up / log in:**
```bash
fly auth signup   # or: fly auth login if you already have an account
```

**3. From the repo root, launch it:**
```bash
fly launch
```
It'll ask a few questions:
- App name → anything, e.g. `obi-transcode`
- Region → pick the closest to you
- Postgres/Redis? → No to both
- Deploy now? → Yes

That's it — `fly launch` reads the `Dockerfile` here and builds/deploys
everything. Takes a few minutes the first time (compiling dovi_tool).

**4. Get your server's URL:**
```bash
fly status
```
It'll show something like `https://obi-transcode.fly.dev`. Test it:
```bash
curl https://obi-transcode.fly.dev/health
```
Should return `{"ok":true}`.

**5. Put that URL into your website**

`index.html` doesn't call this server yet — `runFfmpegOptimize`/`downloadMethodScript`
currently only handle the browser-WASM and native-script paths. To wire in real
Dolby-Vision-preserving re-encodes, add a fetch to your deployed URL, e.g.:
```js
const res = await fetch('https://obi-transcode.fly.dev/api/transcode', {
  method: 'POST',
  body: formDataWithVideoAndOpts,
});
```

## Redeploying after changes

Whenever you edit `server-transcode.js`:
```bash
fly deploy
```

## Testing locally first (optional, before paying for hosting)

```bash
docker build -t obi-server .
docker run -p 3001:3001 obi-server
curl http://localhost:3001/health
```

## Files in this folder

```
server-transcode.js   the actual pipeline (extract RPU → encode → inject → mux)
package.json           node dependencies
Dockerfile             installs ffmpeg + dovi_tool + node, all in one image
```

## Cost note

Fly.io's free allowance covers light, occasional use. Real DV re-encodes
are CPU-heavy (minutes per video), so if this gets used a lot you'll
outgrow the free tier — but for testing and low-volume use it's free.
