# OBITO STUDIO front end (React + Vite)

Source for the page served at `/` by `server-rtx-online.js`. Built files are committed in `../public/`, so the server runs without building.

Rebuild after editing `web/src`:

```
cd web
npm install
npm run build
```

Files: `src/App.jsx` (macOS desktop: menu bar, windows, dock, Wi-Fi menu), `src/Optimizer.jsx` (upload / optimize / download logic),
`src/styles.css` (flat glass, gradients only on buttons), `src/Logo.jsx`, `src/icons.jsx`.
Libraries: `thinking-orbs` (idle, uploading), `bot-avatars` clover (working, paused, done), `border-beam` (window border while busy).
