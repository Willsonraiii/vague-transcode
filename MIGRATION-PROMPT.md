# Prompts for a new chat (copy one)

## A. Full continue prompt (use this one)

```text
Continue my project: OBITO STUDIO, a personal online video optimizer for TikTok uploads (the validated "RTX" pipeline).
You are in the same Claude account, so check your memory notes about "Vague Transcode / OBITO STUDIO" first.

Code: clone https://github.com/Willsonraiii/vague-transcode (branch online-rtx-service). If the clone fails, tell me and I will upload a zip.
Before doing anything, read these files from the repo, in order: MIGRATION.md, NEXT-AGENT-PROMPT.md, HANDOFF.md, COMMANDS.md.
Do not restart setup or research. Do not modify tools/ or lib/ (the validated pipeline).

My rules: short answers, simple language, one command block per step, ask at most one question.
Never claim a TikTok success until I confirm it in TikTok Studio. Never touch my source videos.
Windows = PowerShell 5 (no &&), Linux = bash. FFmpeg 9 has no -vsync (use -fps_mode after -c copy).

Where we are: macOS-style glass web UI (React, thinking-orbs, bot-avatars, border-beam), resumable uploads,
Tailscale access from my iPhone in Safari. Today I want to: <WRITE WHAT YOU WANT HERE>
```

## B. Short prompt (repo already up to date and you only need a quick fix)

```text
Project: OBITO STUDIO (repo Willsonraiii/vague-transcode, branch online-rtx-service). Check your memory notes, clone the repo,
read MIGRATION.md first. Keep answers short, one command block per step, never touch tools/ or lib/.
Task: <WRITE HERE>
```

## C. If the clone fails (private repo)
Upload `obito-studio-update.zip` (or a zip of the repo without node_modules) and say: "Use this zip as the repo, then follow prompt A."
