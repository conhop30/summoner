// Regenerates contract/fixtures/*.json. The fixtures are the contract: Summoner (desktop) and
// Summoner Mobile both run their parser against these exact files (see expectations.json), so a
// change to the format shows up as a failing test in whichever repo hasn't caught up.
// Usage: node contract/build-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
mkdirSync(dir, { recursive: true })
const write = (name, value) =>
  writeFileSync(join(dir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')

// A real 1x1 PNG, and the first bytes of a JPEG (enough to pass or fail the type check).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]).toString('base64')

const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const T1 = '2026-09-01T10:00:00.000Z'
const T2 = '2026-09-10T18:30:00.000Z'
const file = (scope, champions, extra = {}) => ({
  format: 'summoner-export', version: 2, scope,
  exported_at: '2026-09-24T12:00:00.000Z',
  source: { app: 'contract-fixtures', app_version: '0' },
  champions, ...extra,
})

// ── Valid files ──────────────────────────────────────────────────────────────

write('concept-minimal.json', file('concept', [
  { id: ID(1), created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Ahri' }, abilities: {} },
]))

// What a phone writes: identity and each ability's name, description and icon. Nothing else.
write('concept-rich.json', file('concept', [
  {
    id: ID(2), created_at: T1, concept_updated_at: T2, tags: ['fox', 'mage'],
    identity: {
      name: 'Nyxara', title: 'The Hollow Lantern', lore: 'Line one.\nLine two.',
      class: ['Mage', 'Support'], role: ['Mid'], attack_type: ['Ranged'], resource_type: 'Mana',
      playstyle: ['Poke', 'Custom idea'], image_position: { x: 62.5, y: 18 },
      splash: { mime: 'image/png', data: PNG },
    },
    abilities: {
      passive: { name: 'Glow', description: 'Passive text.' },
      q: {
        name: 'Lantern Bolt', description: 'Fires a bolt.', icon: { mime: 'image/png', data: PNG },
        journal: { tabs: [{ id: 'tab-one', name: 'Scrapped', content: 'It used to stun.', created_at: T1 }] },
        blocks: [
          { id: 'blk-mega-01', kind: 'alternate_form', name: 'Mega Bolt', description: 'Bigger and slower.' },
          { id: 'blk-recall-01', kind: 'recast', name: 'Lantern Recall', description: 'Pull the lantern back.', condition: 'after Q hits an enemy' },
          { id: 'blk-glow-01', kind: 'passive', name: 'Afterglow' },
        ],
      },
      w: { name: 'Ward' },
      e: {},
      r: { name: 'Eclipse', description: 'The lantern goes out.' },
    },
  },
  { id: ID(3), created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Brakk' }, abilities: {} },
]))

// A concept file that carries things it shouldn't (numbers, blocks, a desktop section). A parser
// keeps the text and drops the rest without complaint: this is what "extraneous data" looks like.
write('concept-extraneous.json', file('concept', [{
  id: ID(13), created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Overpacked' },
  abilities: {
    q: {
      name: 'Bolt', description: 'Text stays.', max_rank: 5, cooldown: [8, 7, 6, 5, 4], cost: [50, 55, 60, 65, 70], cost_type: 'Mana',
      effects: [{ type: 'damage', base: [60, 90, 120, 150, 180] }],
      blocks: [{ id: 'blk-extra-01', kind: 'recast', name: 'Other form', condition: 'when it hits', cooldown: [3, 3, 3], effects: [{ type: 'heal' }], recast: { max_recasts: 9, recast_window: 30 } }],
      journal: { tabs: [{ id: 'tab-one', name: 'Notes', content: 'x', created_at: T1 }] },
      extra: { recast: { max_recasts: 1, recast_window: 3 } },
    },
  },
  desktop: { base_stats: { health: 999 }, builds: [], abilities: {} },
}]))

// A full backup: concept plus everything desktop-owned, including every ability's numbers.
write('full-with-stats.json', file('full', [
  {
    id: ID(4), created_at: T1, concept_updated_at: T2, tags: [],
    identity: { name: 'Ironwall', class: ['Tank'] },
    abilities: {
      q: {
        name: 'Lantern Bolt', description: 'Fires a bolt.',
        journal: { tabs: [{ id: 'tab-one', name: 'Scrapped', content: 'It used to stun.', created_at: T1 }] },
        blocks: [
          { id: 'blk-a-000001', kind: 'alternate_form', name: 'Empowered Bolt', description: 'Bigger.' },
          { id: 'blk-b-000002', kind: 'recast', name: 'Recast', condition: 'after Q hits' },
        ],
      },
      r: { name: 'Eclipse' },
    },
    desktop: {
      base_stats: { health: 620, health_growth: 95, attack_damage: 60, attack_speed: 0.65, attack_speed_growth: 2.5, attack_range: [175], crit_damage_multiplier: 1.75 },
      builds: [{ id: 'build-0001', name: 'Standard', items: [{ item_id: '3078', count: 1 }, { item_id: '1001', count: 2 }] }],
      active_build_id: 'build-0001',
      abilities: {
        q: {
          max_rank: 5, name: 'ignored', cooldown: [8, 7.5, 7, 6.5, 6], cost: [50, 55, 60, 65, 70], cost_type: 'Mana',
          effects: [{
            type: 'damage', damage_type: 'Magic', base: [60, 90, 120, 150, 180], notes: 'On hit',
            ratios: [{ stat: 'AP', values: [0.4, 0.45, 0.5, 0.55, 0.6] }, { stat: 'ad', part: 'bonus', values: [0.1, 0.1, 0.1, 0.1, 0.1] }],
          }],
          blocks: [
            { id: 'blk-a-000001', name: 'ignored', cooldown: [9, 9, 9, 9, 9] },
            { id: 'blk-b-000002', recast: { max_recasts: 2, recast_window: 4, recast_extends_on: 'ignored' } },
          ],
          extra: { recast: { max_recasts: 1, recast_window: 3 }, flavour: 'note' },
        },
        w: { max_rank: 5, cooldown: [14, 13, 12], effects: [{ type: 'shield', base: [50, 80] }, { type: 'taunt', family: 'hard_control', unit: 'seconds', base: [1, 1.5] }] },
        r: { max_rank: 3 },
      },
    },
  },
]))

// The original (pre-mobile) export: raw desktop records, machine-local image paths.
write('legacy-v1.json', {
  format: 'summoner-export', version: 1, exported_at: '2026-08-01T00:00:00.000Z',
  champions: [{
    identity: {
      name: 'Old Timer', title: 'From v1', image_path: 'app-asset://C%3A%5CUsers%5Cx%5Cimages%5Cold.png',
      theme_audio: { name: 'theme.mp3', src: 'app-asset://C%3A%5Ctheme.mp3' }, class: ['Fighter'],
    },
    base_stats: { health: 600, attack_range: [125] },
    abilities: { q: { max_rank: 5, name: 'Old Q', cooldown: [9, 8, 7, 6, 5], icon_path: 'app-asset://C%3A%5Cicon.png', journal: { tabs: [{ id: 'tab-one', name: 'Old note', content: 'kept', created_at: T1 }] }, blocks: [{ kind: 'recast', name: 'Legacy recast', description: 'From v1.', cooldown: [3, 3, 3, 3, 3], recast: { max_recasts: 2, recast_window: 4, recast_extends_on: 'after a hit' } }] } },
    builds: [{ id: 'build-0002', name: 'Build 1', items: [{ item_id: '1055', count: 1 }] }],
    active_build_id: 'build-0002',
    metadata: { id: ID(5), created_at: T1, updated_at: T2, version: '1.0', is_favorite: true, tags: ['legacy'] },
  }],
})

write('legacy-bare-array.json', [{
  identity: { name: 'Bare Array' }, base_stats: { attack_range: [0] }, abilities: {}, builds: [], active_build_id: '',
  metadata: { id: ID(6), created_at: T1, updated_at: T1, version: '1.0', is_favorite: false, tags: [] },
}])

// ── Files that must be refused ───────────────────────────────────────────────

write('bad-not-json.json', '{ this is not json')
write('bad-other-format.json', { format: 'something-else', version: 2, scope: 'concept', champions: [] })
write('bad-future-version.json', file('concept', [], { version: 99 }))
write('bad-no-scope.json', { format: 'summoner-export', version: 2, champions: [] })
write('bad-no-champions.json', { format: 'summoner-export', version: 2, scope: 'concept' })
write('bad-not-an-export.json', { hello: 'world' })

// ── Hostile or damaged content: the file loads, the bad parts don't ─────────

// __proto__ / constructor smuggled in at every level. JSON.parse makes them ordinary own keys,
// so the test is that none of it reaches the output and nothing is polluted.
write('hostile-prototype.json', `{
  "format": "summoner-export", "version": 2, "scope": "full", "exported_at": "2026-09-24T12:00:00.000Z",
  "__proto__": { "polluted": true },
  "champions": [{
    "id": "${ID(7)}", "created_at": "${T1}", "concept_updated_at": "${T1}", "tags": ["__proto__"],
    "__proto__": { "polluted": true }, "constructor": { "prototype": { "polluted": true } },
    "identity": { "name": "Proto", "__proto__": { "polluted": true }, "constructor": "x" },
    "abilities": { "q": { "name": "Bolt", "__proto__": { "polluted": true } } },
    "desktop": { "base_stats": {}, "builds": [], "__proto__": { "polluted": true }, "abilities": { "q": { "max_rank": 5, "__proto__": { "polluted": true },
      "extra": { "__proto__": { "polluted": true }, "constructor": "x", "prototype": "x", "kept": "yes" } } } }
  }]
}
`)

// A splash that claims PNG but is JPEG bytes, a data-URI string, a path, and a non-image.
write('hostile-images.json', file('concept', [{
  id: ID(8), created_at: T1, concept_updated_at: T1, tags: [],
  identity: {
    name: 'Bad Pictures', image_path: 'app-asset://C%3A%5CWindows%5Csystem.ini',
    splash: { mime: 'image/png', data: JPEG_HEAD },
  },
  abilities: {
    q: { icon: 'data:image/png;base64,' + PNG, icon_path: 'file:///C:/secret.png' },
    w: { icon: { mime: 'image/svg+xml', data: PNG } },
    e: { icon: { mime: 'image/png', data: 'not base64!!' } },
    r: { icon: { mime: 'image/png', data: PNG } },
  },
}]))

// Control characters are built here (not typed) so this source file stays plain text.
const NUL = String.fromCharCode(0)
const BEL = String.fromCharCode(7)
write('hostile-text.json', file('concept', [{
  id: ID(9), created_at: T1, concept_updated_at: T1, tags: Array.from({ length: 80 }, (_, i) => `tag${i}`),
  identity: {
    name: 'N'.repeat(200), title: `Tab\tand${NUL}null${BEL}bell`, lore: 'ok',
    image_position: { x: 250, y: -40 },
  },
  abilities: {
    q: { name: 'Q'.repeat(300), description: `Line\nbreak and ${String.fromCharCode(1)} control` },
    w: { name: 12, description: { not: 'text' } },
  },
}]))

// Damaged numbers inside the desktop section of a full file.
write('hostile-full-numbers.json', file('full', [{
  id: ID(14), created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Numbers' }, abilities: {},
  desktop: {
    base_stats: { health: 1e30, attack_speed: '0.65', armor: null, attack_range: [175, 'far', 550], bogus_stat: 5 },
    builds: [{ id: 'build-x1', name: 'X', items: [{ item_id: '../../etc', count: 5 }, { item_id: '3078', count: 500 }, 'not an id!', '1001'] }],
    abilities: {
      q: {
        max_rank: 99, cooldown: [1e30, '12', null, 5, 6, 7, 8, 9], cost: 'free',
        effects: [{ type: 'damage', damage_type: 'Fire', base: [10, 20] }, 'nonsense', { notes: 'no type' }, { type: 'sleep', family: 'bogus', unit: 'gallons', base: [1], ratios: [{ stat: 'ad', part: 'sideways', values: [1] }] }],
      },
      w: { max_rank: 2, cooldown: [10, 9, 8, 7] },
      e: { max_rank: 'many' },
    },
  },
}]))

write('hostile-blocks.json', file('concept', [{
  id: ID(15), created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Blocks' },
  abilities: {
    q: {
      blocks: [
        { id: 'blk-good-001', kind: 'passive', name: 'Good' },
        { id: 'blk-bad-kind', kind: 'ultimate', name: 'Wrong kind' },
        { kind: 'passive', name: 'No id' },
        { id: 'blk-good-001', kind: 'recast', name: 'Same id again' },
        'not a block',
      ],
    },
    w: { blocks: Array.from({ length: 25 }, (_, i) => ({ id: `blk-many-${String(i).padStart(3, '0')}`, kind: 'passive', name: `Part ${i}` })) },
  },
}]))

write('hostile-records.json', file('concept', [
  { id: ID(10), created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Fine' }, abilities: {} },
  { id: ID(11), created_at: T1, concept_updated_at: T1, tags: [], identity: { title: 'No name' }, abilities: {} },
  { id: 'x', created_at: T1, concept_updated_at: T1, tags: [], identity: { name: 'Bad id' }, abilities: {} },
  { id: ID(12), created_at: 'yesterday-ish', concept_updated_at: 'never', tags: [], identity: { name: 'Bad date' }, abilities: {} },
  { id: ID(10), created_at: T1, concept_updated_at: T2, tags: [], identity: { name: 'Duplicate' }, abilities: {} },
  'not an object',
  null,
]))
