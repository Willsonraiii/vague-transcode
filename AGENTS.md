# AGENTS.md — Obito Studio (`vague-transcode`)

Always-on summary for any coding agent (Antigravity, Cursor, Claude Code, Codex…).
Depth lives in `agent-docs/` — read in this order before doing project work:

1. `agent-docs/MIGRATION.md` — the project book; its **CURRENT STATUS** section is the single source of truth.
2. `agent-docs/AGENTS.md` — full architecture + user non-negotiables.
3. `agent-docs/COMMANDS.md` — build, test, deploy, patch workflow, TikTok ops.

---

## What this is

Lossless 60/120 fps + HDR video mastering for TikTok. Express server (`server-rtx-online.js`) + React/Vite SPA (`web/` → builds into `public/`). Production is a **Suga Cloud** container that **auto-deploys on every push to `online-rtx-service`**; live at `https://obitostudio.willsonrai.com.np`. Members and TikTok connections persist through a private GitHub Gist because a redeploy wipes the container disk.

Current focus (2026-10-17): a TikTok optimizer timing fix was validated by the user on two separate 60-fps videos. The prepared pipeline change preserves source timing (speed factor 1) while retaining two AAC tracks and unknown mvhd behavior; it is pending push/deployment. TikTok integration remains Direct Post only (drafts parked); app review is In review.

## Hard rules — never break

1. **Lossless only.** Container surgery (`-c copy`), 19200 timescale harmonization, color transfer atoms preserved. Never re-encode pixels unless the user explicitly asks for the H.264 fallback.
2. **Zero cloud RAM spikes.** Remote inspection = HTTP Range probe (`bytes=0-1572863`). Never download whole videos into memory.
3. **Secrets.** Never print, commit or paste a real `ACCESS_TOKEN`, TikTok client secret, `TIKTOK_TOKEN_KEY`, or Gist token. Environment-variable *names* only, in docs and chat.
4. **No AI/"vibe-coded" visuals.** No sparkle emojis, no purple/blue gradient text, no badge pills. Apple / DaVinci studio look: solid white headings, slate/cyan accents — always built with **iOS 26 liquid-glass glassmorphism**. Every new or edited UI surface (nav, buttons, cards, frames, menus, overlays) must use translucent frosted panels (`backdrop-blur`), hairline translucent borders, inset specular highlights and soft depth — never flat opaque cards or cheap pills.
5. **Port 3005 is production.** Never bind, test, or experiment against it. Experiments use 3006.
6. **Decisions already made — do not reopen:** no color-grade presets; TikTok products = Login Kit + Content Posting API only; legal contact `resume@willsonrai.com.np`.
7. **Do not touch the TikTok developer portal** (app `7696831141604771848`): products, scopes, URLs, demo video, review text. The app is **In review** — any edit re-triggers the queue.
8. **Experiments ONLY in cloned repo (strict).** When the user asks to experiment with or develop any new updates (UI redesigns, pipeline experiments, or feature prototypes), work MUST be performed **ONLY in a cloned repository** (isolated worktree/clone). Never experiment directly on this main production branch. If a cloned repository does not already exist, the agent MUST explicitly ask the owner for permission to clone before doing anything. Strict following required.

## Build & ship

- Frontend: `npm --prefix web run build` — must print `✓ built`; the rebuilt `public/` assets are committed with the change (Suga serves committed files).
- Pushing to `origin/online-rtx-service` triggers the redeploy (~2–3 min). A redeploy restarts the server: in-flight jobs are lost (by design); members + TikTok connections restore from the Gist. **Don't push while a TikTok post is processing.**
- Verify a deploy: `curl -s https://obitostudio.willsonrai.com.np/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'` must equal the file name in `public/assets`. `/api/tiktok/config` shows the TikTok flags (`inboxUpload` must be `false` while drafts are parked).
- No push access? Produce a patch and say how many commits it holds: `git format-patch origin/online-rtx-service --stdout > <name>.patch`.

## Permissions (agents here may run commands without being asked — treat these as law)

- **Allowed without asking:** reading anything; frontend build; `git status/diff/log`; editing `web/src/`, `lib/`, `tools/`, `agent-docs/`.
- **Ask first:** any `git push`; installing/updating npm packages; anything that changes TikTok/auth behavior in `server-rtx-online.js`; deleting anything outside `/tmp`; touching the TikTok portal; cloning the repository for experiments (if a clone does not exist).
- **Never:** commit secrets; `git reset --hard` / `git clean -xfd` over uncommitted work; run experiments against port 3005; run experiments or prototype changes directly on this main production branch (experiments belong ONLY in a cloned repo with owner approval); leave test videos or job outputs in the repo (fixtures in `/tmp`).

## Style & self-verification

- Reply in short, detailed bullets. Put detail into files, not chat.
- **Before finishing any turn:** run the build and confirm `✓ built`; verify every literal requirement the user stated (character limits, exact quoted sentences) *inside the delivered file*; verify claims about the live site with a `curl` instead of asserting them.
