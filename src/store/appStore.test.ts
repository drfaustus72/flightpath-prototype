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
    const choices = { caption: ' Lunch at DZ ', routeVisibility: 'full', clubId: 'club-hfa', postVisibility: 'public' } as const

    const store = createAppStore(world)
    const first = store.getState().logFlight(imported.draft, choices)
    expect(first.flight.pilotId).toBe('acct-maya')
    expect(first.flight.caption).toBe('Lunch at DZ')
    expect(first.earned.map((a) => a.code)).toEqual(['badge:first_flight', 'stamp:KHHR', 'stamp:KAVX'])
    expect(store.getState().logFlight(imported.draft, choices).earned).toEqual([])

    const reloaded = createAppStore(world)
    expect(reloaded.getState().world.flights).toHaveLength(2)
    expect(reloaded.getState().world.achievements).toHaveLength(3)
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
      store.getState().logFlight(r.draft, { caption: '', routeVisibility: 'full', clubId: 'club-coastal', postVisibility: 'public' }),
    ).toThrow("Can't tag a club")
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
