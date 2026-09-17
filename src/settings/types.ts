export type ThemeMode = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  music_enabled: boolean;
  music_volume: number;
  window_frameless: boolean;
  window_fullscreen: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  music_enabled: false,
  music_volume: 0.5,
  window_frameless: true,
  window_fullscreen: false,
};
