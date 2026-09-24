# Summoner interchange format, version 2

The file format two apps share: **Summoner** (desktop, Electron) and **Summoner Mobile** (Android). It is the only thing that connects them. There is no server, no sync service, and no shared code at runtime.

This folder is the contract. `SPEC.md` says what the format is; `fixtures/` are example files; `expectations.json` says exactly what a parser must do with each one. Both repos carry an identical copy of this folder and run the same tests against it. **If you change the format, change it here first, in both repos, or the tests will tell you they've drifted.**

Reference implementation: `src/interchange/` (parser and sanitizer, no dependencies, vendored unchanged into Summoner Mobile) and `src/champion/exchange.ts` (merge rules, desktop side).

## Principles

1. **Import updates, never overwrites.** Each side owns certain fields. A file can only change the fields its scope covers.
2. **Nothing enters the app except through the whitelist.** Every field is read by name and rebuilt into a fresh object. Unknown keys, oversized text, bad numbers, `__proto__`, and non-image "images" are dropped, and the user is told.
3. **Files are self-contained.** Images travel inside the file. A file never contains a path or URL that means something on another machine.
4. **Old files keep working.** Version 1 files (the pre-mobile desktop export) still import.

## File shape

```jsonc
{
  "format": "summoner-export",       // required, exactly this
  "version": 2,                       // required, integer. Newer than this app knows = refused
  "scope": "concept",                 // "concept" | "full"
  "exported_at": "2026-09-24T12:00:00.000Z",
  "source": { "app": "summoner-desktop", "app_version": "0.2.4" },   // informational
  "champions": [ /* ChampionRecord, at most 500 */ ]
}
```

A file over 100 MB is refused before it is parsed.

### Scopes

| scope | contains | written by |
|---|---|---|
| `concept` | what a champion *is*: identity, splash art, lore, tags, and each ability's **name, description and icon** | both apps |
| `full` | concept **plus** a `desktop` section: base stats, item builds, and every ability's numbers, blocks and notes | desktop only ("Export backup") |

Summoner Mobile never writes `full`, and ignores the `desktop` section of any file it reads (it is dropped, not stored). It also drops any ability field outside name, description and icon, even in a `concept` file: the phone is about the idea of a champion, not its numbers.

### ChampionRecord

```jsonc
{
  "id": "uuid",                        // 8-64 chars of A-Z a-z 0-9 _ -
  "created_at": "ISO date",
  "concept_updated_at": "ISO date",    // when identity, ability text or tags last changed. Decides who is newer
  "tags": ["fox"],                     // at most 50, each at most 40 chars
  "identity": { ... },
  "abilities": { "passive": {...}, "q": {...}, "w": {...}, "e": {...}, "r": {...} },   // text only, see below
  "desktop": { ... }                   // scope "full" only
}
```

`concept_updated_at` moves only when the concept side changes. Editing stats, builds, or an ability's cooldown, cost, effects, blocks or notes on the desktop does not move it. That is what lets a phone's edit and a desktop's number tweak coexist.

### identity

| field | type | limit |
|---|---|---|
| `name` | string, **required** | 80 chars |
| `title` | string | 120 |
| `lore` | string | 20,000 |
| `class`, `role` | string[] | 10 items, 30 chars each |
| `attack_type` | string[] | 4 items |
| `resource_type` | string | 30 |
| `playstyle` | string[] | 20 items, 40 chars |
| `image_position` | `{x, y}` | each clamped 0–100 (splash focal point, percent) |
| `splash` | ImageRef | see Images |

### abilities (the concept side)

Each of `passive`, `q`, `w`, `e`, `r` may be missing or `{}`; every slot is always present after parsing.

| field | notes |
|---|---|
| `name` | string, 80 chars |
| `description` | string, 4,000 chars |
| `icon` | ImageRef |

That is all. The phone shows the ability the way the desktop's View page does, by name and description. Any other field in an ability is dropped.

Text limits: control characters are stripped, over-long text is cut and reported.

### desktop (scope `full` only)

`{ base_stats, builds, active_build_id, abilities }`. Summoner Mobile does not read this section.

- **`base_stats`**: a fixed whitelist of numbers (`health`, `health_growth`, ... `crit_damage_multiplier`, and `attack_range[]`).
- **`builds`**: up to 10, each up to 12 `{item_id, count}`.
- **`abilities`**: for each slot, everything about it that isn't name, description or icon:

| field | notes |
|---|---|
| `max_rank` | integer 1-6. Defaults to 5 (3 for `r`) |
| `cooldown`, `cost` | number[]; always exactly `max_rank` long after parsing (shorter arrays are padded with their last value, longer are cut) |
| `cost_type` | string, 40 |
| `effects` | up to 20 of `{type, damage_type?, base?, ratios?, duration?, notes?}`. `type` is required (40 chars); `damage_type` is `Physical`/`Magic`/`True` or dropped; `ratios` up to 10 of `{stat, values[]}` |
| `blocks` | up to 20 of `{kind, name?, description?, ...numbers}`. `kind` is `passive`, `alternate_form` or `recast` (others are dropped); a `recast` block carries `recast: {max_recasts, recast_window, recast_static_cooldown?, recast_extends_on?}` |
| `extra` | `{recast?, ...}` up to 20 keys with string/number/boolean values |
| `journal` | `{tabs: [{id, name, content, created_at}]}`, up to 50 tabs, 20,000 chars each |

Numbers must be real JSON numbers (strings like `"12"` are dropped) and are clamped to +-1,000,000.

### Images

```jsonc
{ "mime": "image/jpeg", "data": "<base64>" }
```

`mime` is `image/jpeg`, `image/png` or `image/webp`. `data` must be valid base64, at most about 3.3 MB decoded, and its first bytes must match the declared type. An image that fails is **dropped with a warning; the champion still imports.** Anything else in an image position (a URL, a data URI, a path) is dropped the same way.

Exporters shrink first: splash art to at most 1920 px on its long side (JPEG), ability icons to at most 256 px (PNG). Audio is never part of the format; theme audio stays on the desktop.

## Import rules

Records are matched by `id`. For each one, compare `concept_updated_at` with the local champion's:

| situation | status | what happens |
|---|---|---|
| no local champion with that id | **new** | added. The desktop fills stats and builds with defaults |
| stamps equal | **unchanged** | skipped |
| file is newer | **update** | concept fields replaced from the file |
| local is newer | **newer here** | the user chooses: *keep mine* (default), *use the file's*, or *keep both* (import as a separate copy with a new id, named "… (imported)") |

What an update touches:

- **Concept fields** (identity, tags, and each ability's name, description and icon) are replaced by the file's, **including absence**: if the file has no splash, the local splash is removed; if it has no name for the Q, the local Q name is cleared. The local `concept_updated_at` becomes the file's, so importing the same file again is a no-op.
- **Never touched by a `concept` file:** base stats, builds, every ability's numbers, blocks and notes, theme audio, the favorite flag. A champion's abilities keep their cooldowns, costs and effects while their names and descriptions change.
- A `full` file additionally replaces stats, builds and every ability's numbers, blocks and notes.

Errors that refuse the whole file: not JSON, not a Summoner export, a newer version than the app knows, a missing `scope`/`champions`, more than 500 champions, a file over the size limit. Problems inside one champion trim or skip only that champion. Skipped or trimmed items are listed to the user, never silent.

## Version 1 (legacy)

The original desktop export: `{format, version: 1, exported_at, champions: [raw desktop records]}` (a bare array is accepted too). Records are lifted into the current shape: `metadata.id` → `id`, `metadata.updated_at` → `concept_updated_at`, stats, builds and ability numbers/blocks/notes → `desktop`; ability names and descriptions stay in the concept. Image paths and theme audio are dropped (they pointed at files on another machine), with one warning. Treated as scope `full`.

## Changing the format

- Additive and optional changes stay at version 2 only if older parsers ignore them safely (they do: unknown keys are dropped).
- Anything else bumps `version`. Old parsers then refuse the file with "made by a newer version", which is the intended failure.
- Add a fixture and an `expectations.json` entry for every rule. Run `node contract/build-fixtures.mjs` to regenerate fixtures, then copy the whole `contract/` folder and `src/interchange/` to the other repo.
