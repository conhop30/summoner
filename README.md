# Summoner

A desktop app for designing original League of Legends-style champion concepts — identity, lore, base stats, abilities, and itemization — with data persisted locally and no account or server required.

Built with Electron, React, TypeScript, Vite, Zustand, and a local SQLite database (`better-sqlite3`).

## Features

- **Champion gallery** — browse, search, filter, and favorite your champion concepts.
- **Champion editor** — story/identity, base stats with per-level growth, and a full ability kit editor (passive + Q/W/E/R) with an ability journal.
- **Item system** — syncs the live item list from Riot's public Data Dragon feed (no API key required), with search, category tabs, and a sort rail mirroring the in-client store. Stacking rules (e.g. Health Potions, Control Wards) are read from Data Dragon's own data rather than hardcoded, with one deliberate exception: Control Ward's hard 2-item cap, which Riot's data doesn't expose.
- **Multi-build theorycrafting** — each champion can hold several named item builds (tabbed), with a live stat comparison against the champion's base stats. Available both from a champion's editor and from the standalone Items page (pick any champion to compare against).
- **Settings** — Dark / Light / System theme, frameless-window and fullscreen-on-launch toggles (persisted, applied at next launch), a music player (silent until you drop a track at `public/audio/theme.mp3`), and JSON export/import of your champion data for moving between machines.

## Development

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches the Electron window with hot reload. Closing the window ends the whole dev process (by design, via `vite-plugin-electron`) — just re-run `npm run dev` to bring it back.

```bash
npm run build   # typecheck, build, and package with electron-builder
npm run lint
```

## Project layout

- `electron/` — Electron main process (`main.ts`) and preload bridge (`preload.ts`). All `window.summoner.*` IPC surface is defined here.
- `src/champion/`, `src/item/`, `src/settings/` — domain logic and types, shared between the main process (via direct import) and the renderer.
- `src/db/` — SQLite schema and connection (single file in the OS user-data directory).
- `src/gallery/`, `src/editor/`, `src/items/`, `src/settings/` — renderer UI, one folder per feature area.
