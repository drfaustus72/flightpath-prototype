import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import { canConfirmSimSession } from '../domain/achievements'
import { type PostChoices, createFlight } from '../domain/flights'
import type { FlightDraft } from '../domain/track/importTrack'
import { type AirportRecord, type Badge, newlyEarned, recognitionFor } from '../domain/recognition'
import { canTagInstructor } from '../domain/signoffs'
import * as missionOps from '../domain/missionOps'
import * as ops from '../domain/socialOps'
import type { Flight, MilestoneCode, ProfileLevel, Report, World } from '../domain/types'
import { isBlocked } from '../domain/visibility'
import { demoPersonas, loadWorld } from '../domain/world'

/** Bump whenever the persisted shape changes. Old state is discarded and reset to seed. */
export const STORAGE_VERSION = 6
export const STORAGE_KEY = 'flightpath-demo'

export interface AppState {
  world: World
  seedFingerprint: string
  activeAccountId: string
  setActiveAccount: (accountId: string) => void
  /** Saves a flight for the active persona and returns it with the airports and badges it newly earned. */
  logFlight: (draft: FlightDraft, choices: PostChoices) => { flight: Flight; newAirports: AirportRecord[]; newBadges: Badge[] }
  /** The active pilot updates the logbook details they entered at sign-up. */
  updateLogbook: (entry: { totalHours: number; flightReviewOn: string | null }) => void
  /** A school admin or staff CFI confirms or declines a simulator session tagged to their school. */
  reviewSimSession: (flightId: string, decision: 'confirmed' | 'declined') => void

  // Social layer and CFI sign-offs. All act as the active persona; rules live in domain/socialOps.ts.
  setProfileLevel: (level: ProfileLevel) => void
  follow: (accountId: string) => void
  unfollow: (accountId: string) => void
  answerFollowRequest: (followerId: string, approve: boolean) => void
  toggleProps: (flightId: string) => void
  addComment: (flightId: string, text: string) => void
  answerTag: (flightId: string, accept: boolean) => void
  addDebrief: (flightId: string, text: string) => void
  signOffFlight: (flightId: string, note: string) => void
  signOffMilestone: (studentId: string, milestone: MilestoneCode, note: string, schoolAircraft: boolean) => void
  revokeSignoff: (signoffId: string, reason: string) => void
  requestSignoff: (cfiId: string, milestone: MilestoneCode) => void
  declineSignoffRequest: (requestId: string) => void
  claimMilestone: (milestone: MilestoneCode) => void
  block: (accountId: string) => void
  unblock: (accountId: string) => void
  report: (target: Report['target'], reason: Report['reason']) => void

  // Missions, challenges and no-gos (domain/missionOps.ts).
  verifyMission: (flightId: string, missionCode: string) => void
  revokeMissionVerification: (verificationId: string, reason: string) => void
  joinChallenge: (code: string) => void
  leaveChallenge: (code: string) => void
  recordNoGo: (entry: { from: string; to: string | null; reason: string }) => void

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
      (set, get) => {
        /** Runs a domain transition as the active persona with a fresh id and timestamp. */
        const act = (fn: (world: World, actorId: string, ctx: ops.OpContext) => World) => {
          const { world, activeAccountId } = get()
          set({ world: fn(world, activeAccountId, { id: crypto.randomUUID(), now: new Date().toISOString() }) })
        }
        return {
        ...seed(),
        setActiveAccount: (accountId) => {
          if (!get().world.accounts.some((a) => a.id === accountId)) {
            throw new Error(`Unknown account: ${accountId}`)
          }
          set({ activeAccountId: accountId })
        },
        logFlight: (draft, choices) => {
          const { world, activeAccountId } = get()
          if (choices.instructorId !== null && !canTagInstructor(world, activeAccountId, choices.instructorId)) {
            throw new Error(`Can't tag ${choices.instructorId} as instructor`)
          }
          for (const id of choices.flewWithIds) {
            if (id === activeAccountId || !world.accounts.some((a) => a.id === id) || isBlocked(world, activeAccountId, id)) {
              throw new Error(`Can't tag ${id} on this flight`)
            }
          }
          if (choices.clubId !== null) {
            const member = world.memberships.some(
              (m) => m.accountId === activeAccountId && m.clubId === choices.clubId && m.status === 'active',
            )
            if (!member) throw new Error(`Can't tag a club you don't belong to: ${choices.clubId}`)
          }
          const flight = createFlight(draft, choices, activeAccountId, crypto.randomUUID(), new Date().toISOString())
          const next = { ...world, flights: [...world.flights, flight] }
          const earned = newlyEarned(recognitionFor(world, activeAccountId), recognitionFor(next, activeAccountId))
          set({ world: next })
          return { flight, newAirports: earned.airports, newBadges: earned.badges }
        },
        updateLogbook: ({ totalHours, flightReviewOn }) => {
          if (!Number.isFinite(totalHours) || totalHours < 0 || totalHours > 100_000) {
            throw new Error(`Total hours must be between 0 and 100,000 (got ${totalHours})`)
          }
          if (flightReviewOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(flightReviewOn)) {
            throw new Error(`Flight review date must be YYYY-MM-DD (got ${flightReviewOn})`)
          }
          const { world, activeAccountId } = get()
          set({
            world: {
              ...world,
              accounts: world.accounts.map((a) =>
                a.id !== activeAccountId
                  ? a
                  : {
                      ...a,
                      totalHours,
                      // Changing the total un-verifies it until a new logbook upload.
                      hoursSource: totalHours === a.totalHours ? a.hoursSource : 'self_reported',
                      flightReviewOn,
                    },
              ),
            },
          })
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
        setProfileLevel: (level) => act((w, me) => ops.setProfileLevel(w, me, level)),
        follow: (id) => act((w, me, c) => ops.follow(w, me, id, c)),
        unfollow: (id) => act((w, me) => ops.unfollow(w, me, id)),
        answerFollowRequest: (followerId, approve) => act((w, me) => ops.answerFollowRequest(w, me, followerId, approve)),
        toggleProps: (flightId) => act((w, me, c) => ops.toggleProps(w, me, flightId, c)),
        addComment: (flightId, text) => act((w, me, c) => ops.addComment(w, me, flightId, text, c)),
        answerTag: (flightId, accept) => act((w, me) => ops.answerTag(w, me, flightId, accept)),
        addDebrief: (flightId, text) => act((w, me, c) => ops.addDebrief(w, me, flightId, text, c)),
        signOffFlight: (flightId, note) => act((w, me, c) => ops.signOffFlight(w, me, flightId, note, c)),
        signOffMilestone: (studentId, milestone, note, schoolAircraft) =>
          act((w, me, c) => ops.signOffMilestone(w, me, studentId, milestone, note, schoolAircraft, c)),
        revokeSignoff: (signoffId, reason) => act((w, me, c) => ops.revokeSignoff(w, me, signoffId, reason, c)),
        requestSignoff: (cfiId, milestone) => act((w, me, c) => ops.requestSignoff(w, me, cfiId, milestone, c)),
        declineSignoffRequest: (requestId) => act((w, me) => ops.declineSignoffRequest(w, me, requestId)),
        claimMilestone: (milestone) => act((w, me, c) => ops.claimMilestone(w, me, milestone, c)),
        block: (id) => act((w, me, c) => ops.block(w, me, id, c)),
        unblock: (id) => act((w, me) => ops.unblock(w, me, id)),
        report: (target, reason) => act((w, me, c) => ops.report(w, me, target, reason, c)),
        verifyMission: (flightId, code) => act((w, me, c) => missionOps.verifyMission(w, me, flightId, code, c)),
        revokeMissionVerification: (id, reason) => act((w, me, c) => missionOps.revokeMissionVerification(w, me, id, reason, c)),
        joinChallenge: (code) => act((w, me, c) => missionOps.joinChallenge(w, me, code, c)),
        leaveChallenge: (code) => act((w, me) => missionOps.leaveChallenge(w, me, code)),
        recordNoGo: (entry) => act((w, me, c) => missionOps.recordNoGo(w, me, entry, c)),
        resetDemo: () => set(seed()),
        }
      },
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
