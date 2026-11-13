import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { follow, makeAccount, makeCfi, makeClub, makeMembership, makeWorld } from '../test/factories'
import { search, suggestionsFor } from './discovery'
import type { World } from './types'

const me = makeAccount({ id: 'me', handle: 'me', homeAirport: 'KHHR' })
const disco = makeAccount({ id: 'd', handle: 'disco_pilot', displayName: 'Dana Disco', profileLevel: 'discoverable' })
const pub = makeAccount({ id: 'p', handle: 'pub_pilot', displayName: 'Pat Public', profileLevel: 'public' })
const priv = makeAccount({ id: 'x', handle: 'priv_pilot', displayName: 'Pri Vate', profileLevel: 'private' })
const minor = makeAccount({ id: 'm', handle: 'minor_pilot', displayName: 'Min Or', isMinor: true, profileLevel: 'private' })
const cfi = makeCfi({ id: 'c', handle: 'cfi_carla', displayName: 'Carla Pilot', profileLevel: 'private' })

const w = (extra: Partial<World> = {}) => makeWorld({ accounts: [me, disco, pub, priv, minor, cfi], ...extra })
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('search', () => {
  it('finds Discoverable pilots by name, handle or airport', () => {
    expect(ids(search(w(), 'me', 'dana').pilots)).toEqual(['d'])
    expect(ids(search(w(), 'me', '@disco').pilots)).toEqual(['d'])
    expect(ids(search(w(), 'me', 'khhr').pilots)).toEqual(['d'])
  })

  it('finds Public pilots only on an exact @handle, Private pilots and minors never', () => {
    expect(ids(search(w(), 'me', 'pat').pilots)).toEqual([])
    expect(ids(search(w(), 'me', '@pub_pilot').pilots)).toEqual(['p'])
    expect(ids(search(w(), 'me', 'priv_pilot').pilots)).toEqual([])
    expect(ids(search(w(), 'me', 'minor_pilot').pilots)).toEqual([])
  })

  it('lists verified CFIs as instructors whatever their personal profile level', () => {
    const r = search(w(), 'me', 'carla')
    expect(ids(r.cfis)).toEqual(['c'])
    expect(ids(r.pilots)).toEqual([])
  })

  it('finds schools by name or airport, and ignores one-letter queries', () => {
    const clubs = [makeClub({ id: 's', name: 'Hawthorne Flight Academy' })]
    expect(ids(search(w({ clubs }), 'me', 'hawthorne').clubs)).toEqual(['s'])
    expect(ids(search(w({ clubs }), 'me', 'KHHR').clubs)).toEqual(['s'])
    expect(search(w({ clubs }), 'me', 'h')).toEqual({ pilots: [], cfis: [], clubs: [] })
  })

  it('hides people across a block in both directions', () => {
    const blocks = [{ blockerId: 'd', blockedId: 'me', at: '2026-11-01T00:00:00.000Z' }]
    expect(ids(search(w({ blocks }), 'me', 'dana').pilots)).toEqual([])
  })
})

describe('suggestionsFor', () => {
  it('suggests Discoverable adults with shared context, with the reasons', () => {
    const s = suggestionsFor(w(), 'me')
    expect(s.map((x) => x.account.id)).toEqual(['d'])
    expect(s[0]?.reasons).toEqual(['Based at KHHR'])
  })

  it('ranks a shared club above a shared airport, and skips people already followed', () => {
    const far = makeAccount({ id: 'far', handle: 'far', homeAirport: 'KSMO', profileLevel: 'discoverable' })
    const memberships = [makeMembership({ id: '1', accountId: 'me' }), makeMembership({ id: '2', accountId: 'far' })]
    const world = makeWorld({ accounts: [me, disco, far], clubs: [makeClub()], memberships })
    expect(suggestionsFor(world, 'me').map((x) => x.account.id)).toEqual(['far', 'd'])
    expect(suggestionsFor({ ...world, follows: [follow('me', 'far')] }, 'me').map((x) => x.account.id)).toEqual(['d'])
  })

  it('never suggests minors in the seed data', () => {
    if (!seedResult.ok) throw new Error('seed')
    const world = seedResult.world
    for (const a of world.accounts) {
      expect(suggestionsFor(world, a.id).some((s) => s.account.isMinor)).toBe(false)
    }
  })
})
