import type { ThemeMode } from './types'

// What the window looks like before the app has drawn anything. The saved theme is known in the
// main process before the window exists, so the window can open in the right colours instead of
// flashing Electron's default white, and the loading screen in index.html can match.
// The window's own background only shows for the instant before the page paints (the page's
// loading screen paints its own), so for "system" the operating system's answer is good enough there.

export type LaunchTheme = 'dark' | 'light'

/** The theme the app will end up in: "system" follows the operating system. */
export function resolveLaunchTheme(setting: ThemeMode, systemIsDark: boolean): LaunchTheme {
  if (setting === 'light') return 'light'
  if (setting === 'dark') return 'dark'
  return systemIsDark ? 'dark' : 'light'
}

// The page's own base backgrounds (--bg-base in styles/tokens.css: navy-950 and grey-100), kept
// in step by hand because the main process can't read the stylesheet.
const BACKGROUNDS: Record<LaunchTheme, string> = { dark: '#010a13', light: '#f0ead8' }

export function launchBackground(theme: LaunchTheme): string {
  return BACKGROUNDS[theme]
}

/** The command-line switch that hands the saved theme setting to the page's preload script. */
export const THEME_ARG = '--summoner-theme='

// The page is given the setting itself, not the theme it resolves to. For "system" the page settles
// it with the same check the app uses later (prefers-color-scheme), so the loading screen and the
// app can never disagree, even where the operating system and the page report different things.
export function themeArgument(setting: ThemeMode): string {
  return `${THEME_ARG}${setting}`
}

const SETTINGS: readonly ThemeMode[] = ['dark', 'light', 'system']

/** Reads the theme setting back out of a process's arguments. Anything unexpected is dark, the app's default. */
export function themeFromArguments(argv: readonly string[]): ThemeMode {
  const value = argv.find(a => a.startsWith(THEME_ARG))?.slice(THEME_ARG.length)
  return SETTINGS.find(s => s === value) ?? 'dark'
}
