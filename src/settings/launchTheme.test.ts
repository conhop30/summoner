import { describe, it, expect } from 'vitest'
import { launchBackground, resolveLaunchTheme, themeArgument, themeFromArguments } from './launchTheme'

describe('resolving the theme the window opens in', () => {
  it('uses a chosen theme as it is, whatever the system says', () => {
    expect(resolveLaunchTheme('dark', false)).toBe('dark')
    expect(resolveLaunchTheme('light', true)).toBe('light')
  })

  it('follows the system when the setting is "system"', () => {
    expect(resolveLaunchTheme('system', true)).toBe('dark')
    expect(resolveLaunchTheme('system', false)).toBe('light')
  })
})

describe('the window background', () => {
  it('is the page\'s own base colour for each theme, never white', () => {
    expect(launchBackground('dark')).toBe('#010a13')
    expect(launchBackground('light')).toBe('#f0ead8')
    expect(launchBackground('dark').toLowerCase()).not.toBe('#ffffff')
    expect(launchBackground('light').toLowerCase()).not.toBe('#ffffff')
  })
})

describe('handing the theme setting to the page', () => {
  it('round-trips each setting through a command-line argument, "system" included', () => {
    for (const setting of ['dark', 'light', 'system'] as const) {
      expect(themeFromArguments(['electron', '.', themeArgument(setting)])).toBe(setting)
    }
  })

  it('falls back to dark when the argument is missing or unexpected', () => {
    expect(themeFromArguments([])).toBe('dark')
    expect(themeFromArguments(['--summoner-theme=purple'])).toBe('dark')
    expect(themeFromArguments(['--summoner-theme='])).toBe('dark')
  })
})
