import { describe, expect, it, vi } from 'vitest'
import { seedResult } from '../data/seed'
import type { World } from '../domain/types'
import { STORAGE_KEY, STORAGE_VERSION, createAppStore, seedFingerprint } from './appStore'

function seedWorld(): World {
  if (!seedResult.ok) throw new Error('seed invalid')
  return seedResult.world
}

const save = (state: Record<string, unknown>, version = STORAGE_VERSION) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { seedFingerprint: seedFingerprint(seedWorld()), ...state }, version }),
  )

describe('app store', () => {
  it('starts on the first demo persona', () => {
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
  })

  it('switches persona, persists it, and restores it in a new store', () => {
    const a = createAppStore(seedWorld())
    a.getState().setActiveAccount('acct-dan')
    const b = createAppStore(seedWorld())
    expect(b.getState().activeAccountId).toBe('acct-dan')
  })

  it('refuses to switch to an unknown account', () => {
    const store = createAppStore(seedWorld())
    expect(() => store.getState().setActiveAccount('acct-ghost')).toThrow('Unknown account')
  })

  it('resets to seed on demand', () => {
    const store = createAppStore(seedWorld())
    store.getState().setActiveAccount('acct-jordan')
    store.getState().resetDemo()
    expect(store.getState().activeAccountId).toBe('acct-maya')
  })

  it('logs a flight for the active persona, awards stamps once, and persists it', async () => {
    const { importTrack } = await import('../domain/track/importTrack')
    const { synthesize, toGpx } = await import('../domain/track/synth')
    const world = seedWorld()
    const gpx = toGpx(
      synthesize(
        [
          { kind: 'ground', at: 'KHHR', sec: 200 },
          { kind: 'fly', from: 'KHHR', to: 'KAVX', cruiseFt: 4500, kt: 110 },
          { kind: 'ground', at: 'KAVX', sec: 200 },
        ],
        world.airports,
        '2026-11-08T17:00:00Z',
      ),
      'Catalina',
    )
    const imported = importTrack(gpx, 'c.gpx', world.airports)
    if (!imported.ok) throw new Error(imported.error)
    const choices = { caption: ' Lunch at DZ ', routeVisibility: 'full', clubId: 'club-hfa', postVisibility: 'public' as const, instructorId: null, flewWithIds: [] as string[] } as const

    const store = createAppStore(world)
    const first = store.getState().logFlight(imported.draft, choices)
    expect(first.flight.pilotId).toBe('acct-maya')
    expect(first.flight.caption).toBe('Lunch at DZ')
    // Maya's seed flights already earned KHHR and the first-flight badge.
    expect(first.newAirports.map((a) => a.icao)).toEqual(['KAVX'])
    expect(first.newBadges).toEqual([])
    const second = store.getState().logFlight(imported.draft, choices)
    expect(second.newAirports).toEqual([])
    expect(second.newBadges).toEqual([])

    const reloaded = createAppStore(world)
    expect(reloaded.getState().world.flights).toHaveLength(world.flights.length + 2)
  })

  it('marks a tagged sim session pending; only a school admin or staff CFI can confirm it', async () => {
    const { importTrack } = await import('../domain/track/importTrack')
    const { default: kml } = await import('../test/fixtures/foreflight-kemt-kpoc-sim.kml?raw')
    const world = seedWorld()
    const r = importTrack(kml, 'sim.kml', world.airports)
    if (!r.ok) throw new Error(r.error)
    const store = createAppStore(world)
    const { flight, newAirports, newBadges } = store
      .getState()
      .logFlight(r.draft, { caption: '', routeVisibility: 'full', clubId: 'club-hfa', postVisibility: 'public', instructorId: null, flewWithIds: [] })
    expect(newAirports).toEqual([])
    expect(newBadges.map((b) => b.code)).toEqual(['first_sim'])
    expect(flight.simConfirmation?.status).toBe('pending')

    expect(() => store.getState().reviewSimSession(flight.id, 'confirmed')).toThrow('Only an admin or staff CFI')
    store.getState().setActiveAccount('acct-dan') // staff CFI at HFA
    store.getState().reviewSimSession(flight.id, 'confirmed')
    const saved = store.getState().world.flights.find((f) => f.id === flight.id)
    expect(saved?.simConfirmation).toMatchObject({ status: 'confirmed', byAccountId: 'acct-dan' })
  })

  it('updates logbook details; a changed total becomes self-reported again', () => {
    const store = createAppStore(seedWorld())
    store.getState().setActiveAccount('acct-dan') // logbook verified
    store.getState().updateLogbook({ totalHours: 1450, flightReviewOn: '2026-10-01' })
    let dan = store.getState().world.accounts.find((a) => a.id === 'acct-dan')
    expect(dan).toMatchObject({ hoursSource: 'logbook_verified', flightReviewOn: '2026-10-01' })
    store.getState().updateLogbook({ totalHours: 1500, flightReviewOn: null })
    dan = store.getState().world.accounts.find((a) => a.id === 'acct-dan')
    expect(dan).toMatchObject({ totalHours: 1500, hoursSource: 'self_reported', flightReviewOn: null })
    expect(() => store.getState().updateLogbook({ totalHours: -1, flightReviewOn: null })).toThrow('between 0')
  })

  it("refuses to tag a club the pilot doesn't belong to", async () => {
    const { importTrack } = await import('../domain/track/importTrack')
    const store = createAppStore(seedWorld())
    const r = importTrack(
      '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="33.9" lon="-118.3"/><trkpt lat="33.91" lon="-118.3"/></trkseg></trk></gpx>',
      'x.gpx',
      seedWorld().airports,
    )
    if (!r.ok) throw new Error(r.error)
    expect(() =>
      store.getState().logFlight(r.draft, { caption: '', routeVisibility: 'full', clubId: 'club-coastal', postVisibility: 'public', instructorId: null, flewWithIds: [] }),
    ).toThrow("Can't tag a club")
  })

  it('keeps working in memory when storage is full', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const store = createAppStore(seedWorld())
    store.getState().setActiveAccount('acct-dan')
    expect(store.getState().activeAccountId).toBe('acct-dan')
    expect(warn).toHaveBeenCalled()
  })

  it('resets corrupt JSON in storage with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{not json')
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
    expect(warn).toHaveBeenCalled()
  })

  it('resets state saved by an older version', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    save({ world: seedWorld(), activeAccountId: 'acct-dan' }, STORAGE_VERSION - 1)
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
    expect(warn).toHaveBeenCalled()
  })

  it('resets saved state that no longer validates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    save({ world: { accounts: [] }, activeAccountId: 'acct-dan' })
    const store = createAppStore(seedWorld())
    expect(store.getState().world.accounts.length).toBe(seedWorld().accounts.length)
    expect(warn).toHaveBeenCalled()
  })

  it('resets state saved from different seed data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    save({ world: seedWorld(), activeAccountId: 'acct-dan', seedFingerprint: 'old-seed' })
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
    expect(warn).toHaveBeenCalled()
  })

  it('falls back to the default persona if the saved one no longer exists', () => {
    save({ world: seedWorld(), activeAccountId: 'acct-deleted' })
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
  })
})
