import { ipcRenderer, contextBridge } from 'electron'
import type { Champion, Identity, BaseStats, Abilities, NamedBuild } from '../src/champion/types'
import type { Item, ItemSyncResult, ItemSyncStatus } from '../src/item/types'
import type { ChampionCatalogEntry, ChampionCatalogSyncResult, ChampionCatalogSyncStatus } from '../src/championCatalog/types'
import type { AppSettings, MusicTrack } from '../src/settings/types'
import type { UpdateState } from '../src/updater/types'
import type { ImportPlanResult, ImportApplyResult } from '../src/champion/importTypes'
import type { LocalNewerChoice } from '../src/champion/exchange'
import { themeFromArguments } from '../src/settings/launchTheme'

contextBridge.exposeInMainWorld('summoner', {
  // The saved theme setting, so index.html can paint its loading screen in it.
  initialTheme: themeFromArguments(process.argv),

  updater: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('updater:getVersion'),
    getState: (): Promise<UpdateState> => ipcRenderer.invoke('updater:getState'),
    check: (): Promise<void> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<void> => ipcRenderer.invoke('updater:download'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    onState: (cb: (state: UpdateState) => void): (() => void) => {
      const handler = (_e: unknown, state: UpdateState) => cb(state)
      ipcRenderer.on('updater:state', handler)
      return () => ipcRenderer.removeListener('updater:state', handler)
    },
  },

  music: {
    listBuiltIn: (): Promise<MusicTrack[]> => ipcRenderer.invoke('music:listBuiltIn'),
    addCustom: (): Promise<AppSettings> => ipcRenderer.invoke('music:addCustom'),
    removeCustom: (id: string): Promise<AppSettings> => ipcRenderer.invoke('music:removeCustom', id),
  },

  champion: {
    create: (
      name: string,
      partial?: {
        identity?: Partial<Omit<Identity, 'name'>>
        base_stats?: Partial<BaseStats>
        abilities?: Partial<Abilities>
        builds?: NamedBuild[]
        active_build_id?: string
      }
    ): Promise<Champion> =>
      ipcRenderer.invoke('champion:create', name, partial),

    get: (id: string): Promise<Champion | null> =>
      ipcRenderer.invoke('champion:get', id),

    getAll: (): Promise<Champion[]> =>
      ipcRenderer.invoke('champion:getAll'),

    update: (
      id: string,
      updates: {
        identity?: Partial<Identity>
        base_stats?: Partial<BaseStats>
        abilities?: Partial<Abilities>
        is_favorite?: boolean
        tags?: string[]
        builds?: NamedBuild[]
        active_build_id?: string
      }
    ): Promise<Champion | null> =>
      ipcRenderer.invoke('champion:update', id, updates),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('champion:delete', id),

    saveImage: (sourcePath: string, championId: string): Promise<string> =>
      ipcRenderer.invoke('champion:saveImage', sourcePath, championId),

    pickTheme: (championId: string): Promise<{ name: string; src: string } | null> =>
      ipcRenderer.invoke('champion:pickTheme', championId),

    removeTheme: (src: string): Promise<void> =>
      ipcRenderer.invoke('champion:removeTheme', src),
  },

  item: {
    sync: (): Promise<ItemSyncResult> =>
      ipcRenderer.invoke('item:sync'),

    getAll: (): Promise<Item[]> =>
      ipcRenderer.invoke('item:getAll'),

    get: (id: string): Promise<Item | null> =>
      ipcRenderer.invoke('item:get', id),

    getSyncStatus: (): Promise<ItemSyncStatus> =>
      ipcRenderer.invoke('item:getSyncStatus'),
  },

  championCatalog: {
    sync: (): Promise<ChampionCatalogSyncResult> =>
      ipcRenderer.invoke('championCatalog:sync'),

    getAll: (): Promise<ChampionCatalogEntry[]> =>
      ipcRenderer.invoke('championCatalog:getAll'),

    getSyncStatus: (): Promise<ChampionCatalogSyncStatus> =>
      ipcRenderer.invoke('championCatalog:getSyncStatus'),
  },

  settings: {
    getAll: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:getAll'),

    update: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', partial),
  },

  windowControls: {
    isFrameless: (): Promise<boolean> =>
      ipcRenderer.invoke('window:isFrameless'),

    minimize: (): Promise<void> =>
      ipcRenderer.invoke('window:minimize'),

    toggleMaximize: (): Promise<void> =>
      ipcRenderer.invoke('window:toggleMaximize'),

    close: (): Promise<void> =>
      ipcRenderer.invoke('window:close'),

    isFullScreen: (): Promise<boolean> =>
      ipcRenderer.invoke('window:isFullScreen'),

    toggleFullScreen: (): Promise<void> =>
      ipcRenderer.invoke('window:toggleFullScreen'),

    // Returns an unsubscribe function.
    onFullScreenChange: (cb: (fullscreen: boolean) => void): (() => void) => {
      const handler = (_e: unknown, on: boolean) => cb(on)
      ipcRenderer.on('window:fullscreenChanged', handler)
      return () => ipcRenderer.removeListener('window:fullscreenChanged', handler)
    },
  },

  data: {
    exportChampions: (scope: 'full' | 'concept'): Promise<{ ok: boolean; path?: string; count?: number; error?: string }> =>
      ipcRenderer.invoke('data:exportChampions', scope),

    importPick: (): Promise<ImportPlanResult> => ipcRenderer.invoke('data:importPick'),

    importApply: (planId: string, choice: LocalNewerChoice): Promise<ImportApplyResult> =>
      ipcRenderer.invoke('data:importApply', planId, choice),

    importCancel: (): Promise<void> => ipcRenderer.invoke('data:importCancel'),
  },
})