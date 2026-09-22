# Summoner

A desktop application for designing original League of Legends-style champion concepts — identity, lore, base stats, ability kits, and itemization — with a polished, in-client-style UI and all data persisted locally on disk.

## Overview

Summoner is a champion design tool for people building original champion concepts (as a hobby, homebrew tabletop-adjacent project, or portfolio piece) who want the *feel* of designing inside Riot's own client rather than filling out a spreadsheet. It provides:

- A **gallery** of every champion concept the user has created, with search, filtering, and favoriting.
- A full **editor** for identity/lore, per-level base stat growth, and a five-slot ability kit (Passive + Q/W/E/R), backed by a scratch-space ability journal for notes that aren't ready to commit yet.
- A **live item catalog** pulled directly from Riot's public Data Dragon feed, so the itemization data (gold costs, stats, stacking rules) is always accurate to the current patch, with zero API key or account required.
- **Build theorycrafting** — up to four named, tabbed item builds per champion, with a real-time stat comparison against the champion's base stats.
- A **showcase view** for presenting a finished concept (splash art, lore, and an icon-row/spotlight ability display) with a one-click downloadable poster image of the full kit.
- **Settings** for theme, window behavior, an optional music player, and JSON export/import so a user's champion library can move between machines without any server.

Everything lives in one local SQLite file — there is no backend, no account system, and no network dependency beyond the optional, read-only Data Dragon sync.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Electron 30** | Cross-platform desktop packaging with full filesystem/native-module access (needed for SQLite and local image storage), while still shipping a web UI. |
| UI | **React 18 + TypeScript** | Component model fits a UI made of many similar, repeating panels (stat rows, ability slots, item cells); TypeScript enforces a single shared shape for a champion record across the main process, preload bridge, and renderer. |
| Build tooling | **Vite 5** + `vite-plugin-electron` | Fast HMR for the renderer *and* the Electron main/preload processes during development, without a separate watch/rebuild pipeline. |
| Routing | **React Router 7**, `createHashRouter` | Electron loads the production build from a `file://` URL, which has no server to resolve path-based routes — hash-based routing (`#/view/:id`) works identically in dev and in the packaged app. |
| State | **Zustand** | Small, hook-based stores for cross-component UI state (e.g. active theme, journal panel open/closed) without Redux-style boilerplate. |
| Persistence | **SQLite via `better-sqlite3`** | Synchronous, embedded, zero-config — a single `.db` file in the OS user-data directory. Native module compiled against Electron's bundled Node ABI via `electron-rebuild`. |
| Data source | **Riot Data Dragon** (public CDN, no key) | Source of truth for real item data (costs, stats, stacking, tags), fetched through Electron's `net` module in the main process and cached into SQLite so the app works offline after the first sync. |
| Rendering (poster export) | **Canvas 2D API** | The "download poster" feature composites the splash art, name, lore, and full ability kit into a single dynamically-sized PNG — measuring text first to size the canvas so nothing gets truncated. |

Architecture note: Electron's main process and the React renderer communicate through a `preload.ts` bridge exposing a narrow `window.summoner.*` API (`contextIsolation` on, no direct Node access from the renderer). Domain logic and types (`src/champion`, `src/item`, `src/settings`) are plain TypeScript with no Electron or React dependency, so the same code is imported directly by the main process (for IPC handlers) and by the renderer (for client-side validation/derivation) without duplication.

## Engineering challenges

A few problems came up during development that were non-obvious enough to be worth documenting:

- **Electron can't route by path in production.** The packaged app serves the renderer from a `file://` URL with no web server behind it, so a path-based router (`/view/123`) 404s once bundled — it only worked in dev because Vite's dev server was resolving the path. Switched to `createHashRouter` so routing works identically in both dev and production.
- **Data Dragon doesn't fully describe item stacking.** Item stack limits (Health Potions ×5, Control Wards ×2, etc.) are read generically from Data Dragon's own `stats.stacks` field rather than hardcoded per item, so the logic automatically stays correct as Riot patches item data. The one exception: Control Ward's stack is a **hard total cap** (buying a third never opens a new slot), while potions **spill into a new slot** once one stack is full — Data Dragon has no field distinguishing these two behaviors, so that single case (`id "2055"`) is the one hardcoded rule in `src/item/buildLogic.ts`.
- **A stale-closure race let builds exceed their slot cap.** Rapid clicking on the standalone item-comparison page could push a build past its 6-slot limit, because the click handler was closing over a state snapshot from before the previous click's async update had committed. Fixed by moving build state fully local and updating it through functional `setState` calls, with persistence to SQLite firing-and-forgetting in the background instead of gating the next click.
- **Item slots were keyed by item identity instead of position.** The build-slot grid used each item's id as its React list key. Since the same item can legitimately occupy more than one slot (stacking), this broke React's reconciliation — slots would visually swap or fail to update on removal. The fix was keying by slot *position* instead, which is the correct rule for any positional inventory-style UI (grid slots, hotbars, etc.), regardless of what currently occupies a given slot.
- **Canvas-drawn text can't follow the app's live theme.** The downloadable poster is deliberately always rendered dark, independent of whichever theme (dark/light/system) the app is currently in, because canvas 2D drawing can't reactively read CSS custom properties. Its text colors are therefore separate, explicitly-mirrored constants rather than a live read of the design tokens — a deliberate tradeoff that trades a small amount of duplication for a poster that always looks the same regardless of user settings.
- **Accessibility pass on text contrast.** An early pass at the dark/light color tokens left several text tiers (muted labels, secondary text) sitting right at the WCAG AA floor (~4.5:1), which read as legible in isolated review but felt strained during real use. Retuned every text-color tier in both themes to clear ~7:1 (AAA) against both the base and elevated-surface backgrounds, fixing it once at the design-token layer rather than patching individual components.
- **The window icon and title were never actually wired up.** Both looked fine in the source but were dead code: `BrowserWindow`'s `icon` option pointed at an `.svg`, which Electron's native icon loader silently can't render, and `index.html`'s `<title>` was still the literal Vite template default — so the real OS taskbar icon and window title never matched the custom in-app title bar that *said* "Summoner". Fixed by pointing both at a real `.png`. Also had to add `base: './'` to the Vite config, for the same reason the router had to become hash-based: the packaged app loads over `file://` with no server, so root-absolute asset URLs 404 once bundled, even though they resolve fine in dev.

## Project layout

```
electron/         Main process (main.ts) + preload bridge (preload.ts) — the only place window.summoner IPC is defined
src/db/           SQLite schema + connection (single file in the OS user-data directory)
src/champion/     Champion domain types, CRUD, and derived logic — imported by both main and renderer
src/item/         Item domain types, Data Dragon sync, and build/stacking logic — imported by both main and renderer
src/settings/     Settings domain types and CRUD
src/gallery/      Renderer UI — champion gallery
src/editor/       Renderer UI — champion editor, ability journal, and the showcase "view" page
src/items/        Renderer UI — standalone item browser / build comparison tool
src/settings/     Renderer UI — settings page
src/router/       createHashRouter route table
```

## Roadmap

**Recently shipped**
- Multi-build theorycrafting (tabbed builds, stat comparison) on both the champion editor and the standalone item browser.
- Redesigned showcase/"View" page: icon-row + spotlight ability display, splash-art-forward layout, downloadable full-kit poster.
- App-wide text contrast and section-header sizing pass.
- Editor UX: Framer Motion tab transitions, a collapsible Story panel, item-sort/categorization overhaul, full item stat parsing (structured + description text), a redesigned item browser (collapsible descriptions, responsive side-by-side layout), and a Hextech-mist hover effect on gallery tiles.
- Real window/taskbar icon, app icon, and title — previously silently broken (see Engineering challenges).

**Known issues**
- A couple of stray test build tabs from development were left on a sample champion record and should be cleaned up via the UI.

**Not yet started / open ideas**
- Ability kit: a generic "+"-appended block system on any key (Q/W/E/R/passive) — one mechanism covering appended passives, full alternate abilities under the same key (Jayce/Elise/Rell-style stance or form swaps), and condition-unlocked recasts (Lee Sin-style), additive to the existing single-ability-per-slot data.
- Ability kit: effects should accept per-rank scaling values (traditionally 5 ranks, adjustable), with a suggested-value auto-fill once the first two ranks are entered. AP/AD ratios (e.g. "1% per 100 AP") get their own per-rank values too, not a single flat number.
- Item shop: smaller item icons so 8–10 fit horizontally while the editor's Story panel is open (5–6 is the floor if smaller hurts readability).
- Suggested base/growth stats by class or lane tag: requires a new live Data Dragon champion sync (mirroring the existing item sync) to compute per-class averages and offer real champions as one-click presets. Surfaced as a hover pop-up with an accept action, not a permanent panel.
- View page: styling pass for visual consistency with the League of Legends look (reference: the official champion page layout) — ability preview colors and geometry are currently misaligned.
- Ability icon uploads (kit currently displays slot letters rather than custom icons).
- Roadmap items get added here as new feature work is planned — keep this section current rather than letting it drift from what's actually built.

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
