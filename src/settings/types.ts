export type ThemeMode = 'dark' | 'light' | 'system';

// A playable background-music track. `src` is directly usable as an <audio> src:
// a relative path for built-in songs shipped in public/audio, or an app-asset:// URL
// for a user-added file that was copied into the app's data folder.
export interface MusicTrack {
  id: string;
  name: string;
  src: string;
}

export interface AppSettings {
  theme: ThemeMode;
  music_enabled: boolean;
  music_volume: number;
  // Selected track id ('builtin:<file>' or 'custom:<id>'); '' falls back to the first available.
  music_track: string;
  music_custom_tracks: MusicTrack[];
  window_frameless: boolean;
  window_fullscreen: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  music_enabled: false,
  music_volume: 0.5,
  music_track: '',
  music_custom_tracks: [],
  window_frameless: true,
  window_fullscreen: false,
};
