export type ThemeMode = 'dark' | 'light' | 'system';

// A playable background-music track. `src` is directly usable as an <audio> src:
// a relative path for built-in songs shipped in public/audio, or an app-asset:// URL
// for a user-added file that was copied into the app's data folder.
export interface MusicTrack {
  id: string;
  name: string;
  src: string;
}

// Where an ability effect's extra details (what it scales with, its name, notes, who it affects) are
// edited: in a collapsed "More" under each effect, or on the ability's own Advanced tab.
export type EffectDetailsPlacement = 'inline' | 'tab';

export interface AppSettings {
  theme: ThemeMode;
  music_enabled: boolean;
  music_volume: number;
  // Champion themes have their own volume (the control lives on the theme player), so a quiet
  // background track and a full-volume theme can coexist. Older settings without it inherit
  // music_volume — see getSettings.
  theme_volume: number;
  // Selected track id ('builtin:<file>' or 'custom:<id>'); '' falls back to the first available.
  music_track: string;
  music_custom_tracks: MusicTrack[];
  window_frameless: boolean;
  window_fullscreen: boolean;
  effect_details: EffectDetailsPlacement;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  music_enabled: false,
  music_volume: 0.5,
  theme_volume: 0.5,
  music_track: '',
  music_custom_tracks: [],
  window_frameless: true,
  window_fullscreen: false,
  effect_details: 'inline',
};
