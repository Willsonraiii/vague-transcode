# Switching to a new agent? Paste one of these.

The project carries its own brain in the repo: `MIGRATION.md` (the project book) + `COMMANDS.md` (all terminal commands). Any agent that reads those two can continue safely. Nothing else is required.

## A. Full continue prompt (use this one)

```text
Continue my project: OBITO STUDIO, a personal online video optimizer for TikTok uploads (the validated "RTX" pipeline).
Code: clone https://github.com/Willsonraiii/vague-transcode (branch online-rtx-service). If the clone fails, I will upload a zip.
Before doing anything, read exactly two files, in order: MIGRATION.md, then COMMANDS.md. (HANDOFF.md, NEXT-AGENT-PROMPT.md and ONLINE-SERVICE-PLAN.md are old history logs — only read them if the book says you need background.)
Do not restart setup or research. Do not modify tools/ or lib/ without my OK.

My rules: short answers, simple language, one command block per step, at most one question.
Never claim a TikTok success until I confirm it in TikTok Studio. Never touch my source videos.
Windows = PowerShell 5 (no &&), Linux = bash. FFmpeg 9 has no -vsync (use -fps_mode after -c copy).

Where we are: scrolling macOS-glass web UI (terminal hero, control centre, hidden magnifying dock), resumable uploads, Tailscale phone access working from Windows;
Linux laptop is being prepared as the main server. Today I want to: <WRITE WHAT YOU WANT HERE>
```

## B. Short prompt (quick fix only)

```text
Project: OBITO STUDIO (repo Willsonraiii/vague-transcode, branch online-rtx-service).
Clone it, read MIGRATION.md then COMMANDS.md, keep answers short, one command block per step,
never touch tools/ or lib/. Task: <WRITE HERE>
```

## C. If the clone fails (private repo)

Upload a zip of the repo without node_modules and say: "Use this zip as the repo, then follow prompt A."
