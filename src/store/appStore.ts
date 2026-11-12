import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import { awardForFlight, canConfirmSimSession } from '../domain/achievements'
import { type PostChoices, createFlight } from '../domain/flights'
import type { FlightDraft } from '../domain/track/importTrack'
import type { Achievement, Flight, World } from '../domain/types'
import { demoPersonas, loadWorld } from '../domain/world'

/** Bump whenever the persisted shape changes. Old state is discarded and reset to seed. */
export const STORAGE_VERSION = 3
export const STORAGE_KEY = 'flightpath-demo'

export interface AppState {
  world: World
  seedFingerprint: string
  activeAccountId: string
  setActiveAccount: (accountId: string) => void
  /** Saves a flight for the active persona and returns it with any stamps and badges it earned. */
  logFlight: (draft: FlightDraft, choices: PostChoices) => { flight: Flight; earned: Achievement[] }
  /** A school admin or staff CFI confirms or declines a simulator session tagged to their school. */
  reviewSimSession: (flightId: string, decision: 'confirmed' | 'declined') => void
  resetDemo: () => void
}

type Persisted = Pick<AppState, 'world' | 'activeAccountId'> & { seedFingerprint: string }

/**
 * FNV-1a hash of the seed data. Saved state from a different seed (e.g. after a new
 * build adds flights) is discarded, so testers always see the current demo data.
 */
export function seedFingerprint(world: World): string {
  const text = JSON.stringify(world)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

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
  setItem(name, value) {
    try {
      localStorage.setItem(name, value)
    } catch (error) {
      // Quota exceeded or storage disabled (e.g. private browsing): keep working in memory.
      console.warn('[flightpath] Could not save demo state; changes will last until reload.', error)
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
}

/**
 * Returns persisted state only if it is still a valid world with a known active account;
 * otherwise falls back to seed. Guards against hand-edited or stale storage.
 */
export function reconcilePersisted(persisted: unknown, seed: Persisted): Persisted {
  if (typeof persisted !== 'object' || persisted === null) return seed
  const candidate = persisted as Partial<Persisted>
  if (candidate.seedFingerprint !== seed.seedFingerprint) {
    console.warn('[flightpath] Demo data has changed since this state was saved; resetting to seed.')
    return seed
  }
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
  return { world: loaded.world, activeAccountId, seedFingerprint: seed.seedFingerprint }
}

export function createAppStore(seedWorld: World, storage: StateStorage = safeLocalStorage) {
  const fingerprint = seedFingerprint(seedWorld)
  const seed = (): Persisted => ({
    world: structuredClone(seedWorld),
    activeAccountId: defaultAccountId(seedWorld),
    seedFingerprint: fingerprint,
  })

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
        logFlight: (draft, choices) => {
          const { world, activeAccountId } = get()
          if (choices.clubId !== null) {
            const member = world.memberships.some(
              (m) => m.accountId === activeAccountId && m.clubId === choices.clubId && m.status === 'active',
            )
            if (!member) throw new Error(`Can't tag a club you don't belong to: ${choices.clubId}`)
          }
          const flight = createFlight(draft, choices, activeAccountId, crypto.randomUUID(), new Date().toISOString())
          const earned = awardForFlight(flight, draft.airportsVisited, world.achievements, world.airports)
          set({
            world: {
              ...world,
              flights: [...world.flights, flight],
              achievements: [...world.achievements, ...earned],
            },
          })
          return { flight, earned }
        },
        reviewSimSession: (flightId, decision) => {
          const { world, activeAccountId } = get()
          const flight = world.flights.find((f) => f.id === flightId)
          if (!flight) throw new Error(`Unknown flight: ${flightId}`)
          if (!canConfirmSimSession(flight, activeAccountId, world.memberships)) {
            throw new Error('Only an admin or staff CFI of the tagged school can review this session')
          }
          const reviewed = {
            ...flight,
            simConfirmation: { status: decision, byAccountId: activeAccountId, at: new Date().toISOString() },
          }
          set({ world: { ...world, flights: world.flights.map((f) => (f.id === flightId ? reviewed : f)) } })
        },
        resetDemo: () => set(seed()),
      }),
      {
        name: STORAGE_KEY,
        version: STORAGE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: (s): Persisted => ({ world: s.world, activeAccountId: s.activeAccountId, seedFingerprint: s.seedFingerprint }),
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
