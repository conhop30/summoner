import { ipcRenderer, contextBridge } from 'electron'
import type { Champion, Identity, BaseStats, Abilities, NamedBuild } from '../src/champion/types'
import type { Item, ItemSyncResult, ItemSyncStatus } from '../src/item/types'
import type { ChampionCatalogEntry, ChampionCatalogSyncResult, ChampionCatalogSyncStatus } from '../src/championCatalog/types'
import type { AppSettings, MusicTrack } from '../src/settings/types'
import type { UpdateState } from '../src/updater/types'

contextBridge.exposeInMainWorld('summoner', {
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
  },

  data: {
    exportChampions: (): Promise<{ ok: boolean; path?: string; count?: number; error?: string }> =>
      ipcRenderer.invoke('data:exportChampions'),

    importChampions: (): Promise<{ ok: boolean; count?: number; error?: string }> =>
      ipcRenderer.invoke('data:importChampions'),
  },
})