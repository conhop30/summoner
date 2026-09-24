# Summoner

A desktop application for designing original League of Legends-style champion concepts — identity, lore, base stats, ability kits, and itemization — with a polished, in-client-style UI and all data persisted locally on disk.

## Download

Windows 10/11 installer: [Summoner-Windows-0.2.2-Setup.exe](https://github.com/conhop30/summoner/releases/latest) (see the [project page](https://conhop30.github.io/projects/summoner/) for screenshots). The installer isn't code-signed, so SmartScreen may ask you to choose "More info", then "Run anyway".

## Overview

Summoner is a champion design tool for people building original champion concepts (as a hobby, homebrew tabletop-adjacent project, or portfolio piece) who want the *feel* of designing inside Riot's own client rather than filling out a spreadsheet. It provides:

- A **gallery** of every champion concept the user has created, with search, filtering, and favoriting.
- A full **editor** for identity/lore, per-level base stat growth, and a five-slot ability kit (Passive + Q/W/E/R), backed by a scratch-space ability journal for notes that aren't ready to commit yet.
- A **live item catalog** pulled directly from Riot's public Data Dragon feed, so the itemization data (gold costs, stats, stacking rules) is always accurate to the current patch, with zero API key or account required.
- **Build theorycrafting** — up to four named, tabbed item builds per champion, with a real-time stat comparison against the champion's base stats.
- A **showcase view** for presenting a finished concept (splash art, lore, and an icon-row/spotlight ability display) with a one-click downloadable poster image of the full kit.
- **Settings** for theme, window behavior, an optional background-music player (pick a built-in song or add your own), and JSON export/import so a user's champion library can move between machines without any server.

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
- **Audio wouldn't load from the app's custom protocol.** User-added songs are served through the same `app-asset://` scheme as splash art, but that scheme only worked for images: audio elements fetch with range requests, and Electron silently failed the load (`MEDIA_ERR_SRC_NOT_SUPPORTED`) until the scheme was registered as streamable. It is deliberately *not* registered as a `standard` scheme, since that changes URL parsing and would have broken every splash-art URL already stored in users' databases. A second audio problem surfaced when a progress bar needed to scrub: the file loader answers byte-range requests with a bare `200` and no `Accept-Ranges`, so the element reported the audio as non-seekable (`seekable` was `[0,0]`) and every seek snapped back to the start. Audio is now served by the protocol handler itself with real `200`/`206` responses; images still take the plain path.
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
- View page: ability icons and colors now follow the app's standardized gold/blue Hextech tokens (selected = gold, filled = blue) instead of a per-key rainbow, with square icon geometry and name captions matching the official champion-page reference.
- Ability kit: effects now support per-rank base values and per-rank AP/AD ratios in the editor, with a suggested-scaling-step auto-fill once the first two ranks are entered.
- Ability kit: a generic "+"-appended block system on any key (Q/W/E/R/passive) — one mechanism covering appended passives, full alternate ability bodies under the same key (Jayce/Elise/Rell-style stance or form swaps), and condition-unlocked recasts (Lee Sin-style), additive to the existing single-ability-per-slot data.
- Suggested base/growth stats: a new live Data Dragon champion sync (mirroring the item sync) populates a reference roster, and a pop-up opened by the ✨ "Click for suggestions" hint on the Base Stats panel (a borderless two-line hint whose hover highlight retires after the first click; click to open or close; it stays put until you click away, press Escape, or accept) has two tabs: per-class-tag averages (rounded to whole numbers, apart from attack speed and per-level regen, whose real values are too small to round) and a Champions tab that lists every synced champion under each of its classes, with headline HP/AD/AR/MR and a name search, so one class offers a real range of styles (Tank spans Braum, Leona, Thresh…). Each row has an Accept action. Lane-based suggestions are intentionally not included — Data Dragon has no real per-champion lane field to derive them from.
- Item shop: smaller icons in the compact item browser (embedded in the editor) so 8 fit horizontally while the Story panel is open, up from 5.
- Ability icon uploads: each key (P/Q/W/E/R) can take a custom icon, stored the same way as splash art (copied into the user-data folder, referenced by an `app-asset://` URL on the record). It replaces the slot letter in the editor's key bar and the View page's icon row, and is drawn into the downloadable poster next to each ability.
- In-app updates: on launch the installed app checks GitHub Releases for a newer version (via electron-updater) and shows a non-blocking banner with Update now / Later. Nothing downloads or restarts until the user clicks; the download is checksum-verified, and a Settings section shows the version and a manual Check for updates. Silent failures (offline, no manifest) never nag.
- Background music: a selectable track list in Settings — the League client songs `LoL Classic Login` and `Client In Queue` ship as built-ins (any mp3 dropped in `public/audio/` is picked up automatically), and users can add their own audio files, which are copied into the app data folder and can be removed again. A master toggle (off by default) turns music off entirely — no audio is even loaded while it is off. The original single-file player pointed at a path that could never resolve in the installed app, so music had never worked outside dev. The bundled songs are Riot's music, included as fan-project content.
- Item store: right-clicking an item pins its details in the spotlight panel (a hextech-cyan border with a slow mist drifting around it, an Unpin button, or right-click again). The panel is filled only by a pinned item — nothing previews on hover, so it stays a calm empty slot until asked. In the build panel the six slots sit in one row with the clicked item's full details in a full-width panel beneath them, instead of squeezed beside a small grid.
- Readability pass: the type scale was far below normal desktop sizes (most labels were 8–10px). It now follows the Windows 11 type ramp (12px is the floor and the caption size, 14px is body, 16px and up for headings) with nothing rendering under 12px, and letter-spacing on the uppercase labels was trimmed to compensate. The stat editor's label column was widened and collapses to one column in narrow windows so the larger text never truncates.
- Base stat lookup: a search bar in the Stats tab finds any synced champion by name (punctuation-insensitive, so `kaisa` finds Kai'Sa) and opens a collapsible window listing their stats beside yours, with a checkbox per stat (value and per-level growth together). Tick only what you want — say Poppy's health and armor but Rakan's attack range — and Apply copies just those into the champion. The suggestions pop-up and the lookup share one roster sync.
- Champion themes: each champion can carry one theme song, played in the Story panel by a themed audio player — outlined gold play/pause, a seekable progress indicator with no bar at all — a canvas particle system paints drifting hextech mist over the played part of the song, thickest at its leading edge, which sheds small wisps as it moves (same vapor language as the gallery hover), between two gold diamond endcaps for the start and end; hovering cuts a gold slice through the mist at the pointer, with streaks pulled up and down it, marking where a click will land — it sits exactly on the pointer, trails nothing, and vanishes when the pointer leaves — elapsed/total time, plus Replace and remove. Click or drag the mist (or use the arrow keys) to scrub; clicking it while stopped starts playback from there. Like splash art, the file is copied into the app's data folder and referenced by an `app-asset://` URL, and deleting the champion sweeps it. A Play theme button on the champion's View page plays it; while a theme plays it replaces the background music (which pauses and picks up from the same spot when the theme ends, is stopped, or you leave the page) — and it plays even with background music turned off. State lives in a small shared store with a root-mounted player, so a theme survives route changes until something stops it.
- Deleting champions: a muted-red trash button in each gallery tile's bottom-right corner brightens on hover and opens an in-app confirmation (Cancel is the default; Escape or clicking outside also cancels). Deleting removes the champion record and its uploaded splash art and ability icons from disk. The editor's left rail has the same muted-red Delete button (shown once the champion exists), using the same confirmation; a queued autosave is dropped first so leaving the page can't re-save the deleted champion.
- Brand header: the Summoner logo and name sit in a persistent bar at the top of every page and always return to the gallery. Because it lives outside the route tree, it navigates through the router instance directly; page heights are computed from a shared `--chrome-height` token. In frameless mode the same bar is the title bar — it drags the window and carries the minimize/maximize/close buttons — so the window controls stay pinned while a page scrolls instead of scrolling away with a separate title bar. The bar also carries the app's navigation — Items, a Settings gear icon (replacing the old text button), and a fullscreen toggle — and in fullscreen the window buttons and the native File/Edit/View/Window/Help menu bar are hidden and that in-app navigation takes over, leaving a chrome-free app; windowed mode brings both back (the main process toggles the menu bar and notifies the renderer on enter/leave-full-screen). The editor now also flushes a pending autosave when you leave the page, so navigating away mid-edit can't drop the last change.

**Known issues**
- A couple of stray test build tabs from development were left on a sample champion record and should be cleaned up via the UI.

**Not yet started / open ideas**
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

### Releasing a new version

Bump `version` in `package.json`, then publish with a GitHub token (the release tag is created as `v<version>`):

```bash
GH_TOKEN=$(gh auth token) npm run release
```

This uploads the installer, its blockmap, and `latest.yml` to the release. `latest.yml` is what installed copies read to discover the update, so a release without it is invisible to the updater. Builds before the first updater-enabled version can't self-update and need one manual install.
