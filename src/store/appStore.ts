import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import type { World } from '../domain/types'
import { demoPersonas, loadWorld } from '../domain/world'

/** Bump whenever the persisted shape changes. Old state is discarded and reset to seed. */
export const STORAGE_VERSION = 1
export const STORAGE_KEY = 'flightpath-demo'

export interface AppState {
  world: World
  activeAccountId: string
  setActiveAccount: (accountId: string) => void
  resetDemo: () => void
}

type Persisted = Pick<AppState, 'world' | 'activeAccountId'>

function defaultAccountId(world: World): string {
  const first = demoPersonas(world)[0] ?? world.accounts[0]
  // worldSchema guarantees at least one account, so `first` exists for any validated world.
  if (!first) throw new Error('World has no accounts')
  return first.id
}

/** localStorage wrapper that treats unreadable data as "nothing saved" instead of crashing. */
export const safeLocalStorage: StateStorage = {
  getItem(name) {
    const raw = localStorage.getItem(name)
    if (raw === null) return null
    try {
      JSON.parse(raw)
      return raw
    } catch (error) {
      console.warn(`[flightpath] Saved demo state is corrupt; resetting to seed.`, error)
      localStorage.removeItem(name)
      return null
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}

/**
 * Returns persisted state only if it is still a valid world with a known active account;
 * otherwise falls back to seed. Guards against hand-edited or stale storage.
 */
export function reconcilePersisted(persisted: unknown, seed: Persisted): Persisted {
  if (typeof persisted !== 'object' || persisted === null) return seed
  const candidate = persisted as Partial<Persisted>
  const loaded = loadWorld(candidate.world)
  if (!loaded.ok) {
    console.warn('[flightpath] Saved demo state failed validation; resetting to seed.', loaded.errors)
    return seed
  }
  const activeAccountId =
    typeof candidate.activeAccountId === 'string' &&
    loaded.world.accounts.some((a) => a.id === candidate.activeAccountId)
      ? candidate.activeAccountId
      : defaultAccountId(loaded.world)
  return { world: loaded.world, activeAccountId }
}

export function createAppStore(seedWorld: World, storage: StateStorage = safeLocalStorage) {
  const seed = (): Persisted => ({ world: structuredClone(seedWorld), activeAccountId: defaultAccountId(seedWorld) })

  return createStore<AppState>()(
    persist(
      (set, get) => ({
        ...seed(),
        setActiveAccount: (accountId) => {
          if (!get().world.accounts.some((a) => a.id === accountId)) {
            throw new Error(`Unknown account: ${accountId}`)
          }
          set({ activeAccountId: accountId })
        },
        resetDemo: () => set(seed()),
      }),
      {
        name: STORAGE_KEY,
        version: STORAGE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: (s): Persisted => ({ world: s.world, activeAccountId: s.activeAccountId }),
        migrate: (_persisted, fromVersion) => {
          console.warn(`[flightpath] Saved demo state is version ${fromVersion}, expected ${STORAGE_VERSION}; resetting to seed.`)
          return seed()
        },
        merge: (persisted, current) => ({ ...current, ...reconcilePersisted(persisted, seed()) }),
      },
    ),
  )
}

export type AppStore = ReturnType<typeof createAppStore>
