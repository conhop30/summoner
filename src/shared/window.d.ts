import type { Champion, Identity, BaseStats, Abilities, NamedBuild } from '../champion/types'
import type { Item, ItemSyncResult, ItemSyncStatus } from '../item/types'
import type { ChampionCatalogEntry, ChampionCatalogSyncResult, ChampionCatalogSyncStatus } from '../championCatalog/types'
import type { AppSettings } from '../settings/types'
import type { UpdateState } from '../updater/types'

declare global {
  interface Window {
    summoner: {
      updater: {
        getVersion: () => Promise<string>
        getState: () => Promise<UpdateState>
        check: () => Promise<void>
        download: () => Promise<void>
        install: () => Promise<void>
        onState: (cb: (state: UpdateState) => void) => () => void
      }

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
        ) => Promise<Champion>

        get: (id: string) => Promise<Champion | null>

        getAll: () => Promise<Champion[]>

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
        ) => Promise<Champion | null>

        delete: (id: string) => Promise<boolean>
        saveImage: (sourcePath: string, championId: string) => Promise<string>
      }

      item: {
        sync: () => Promise<ItemSyncResult>
        getAll: () => Promise<Item[]>
        get: (id: string) => Promise<Item | null>
        getSyncStatus: () => Promise<ItemSyncStatus>
      }

      championCatalog: {
        sync: () => Promise<ChampionCatalogSyncResult>
        getAll: () => Promise<ChampionCatalogEntry[]>
        getSyncStatus: () => Promise<ChampionCatalogSyncStatus>
      }

      settings: {
        getAll: () => Promise<AppSettings>
        update: (partial: Partial<AppSettings>) => Promise<AppSettings>
      }

      windowControls: {
        isFrameless: () => Promise<boolean>
        minimize: () => Promise<void>
        toggleMaximize: () => Promise<void>
        close: () => Promise<void>
        isFullScreen: () => Promise<boolean>
        toggleFullScreen: () => Promise<void>
      }

      data: {
        exportChampions: () => Promise<{ ok: boolean; path?: string; count?: number; error?: string }>
        importChampions: () => Promise<{ ok: boolean; count?: number; error?: string }>
      }
    }
  }
}

export {}
