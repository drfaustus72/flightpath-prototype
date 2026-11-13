import { describe, expect, it } from 'vitest'
import { follow, makeAccount, makeCfi, makeClub, makeFlight, makeMembership, makeWorld } from '../test/factories'
import type { Account, World } from './types'
import { canSeeField, canSeeProfile, canViewFlight, effectiveLevel, fieldVisibility, isDiscoverable } from './visibility'

const owner = (over: Partial<Account> = {}) => makeAccount({ id: 'owner', handle: 'owner', ...over })
const viewer = makeAccount({ id: 'viewer', handle: 'viewer' })

function world(o: Account, extra: Partial<World> = {}): World {
  return makeWorld({ accounts: [o, viewer, makeCfi()], ...extra })
}

describe('profile levels', () => {
  it('lets anyone open Public and Discoverable profiles', () => {
    for (const level of ['public', 'discoverable'] as const) {
      expect(canSeeProfile(world(owner({ profileLevel: level })), 'viewer', 'owner')).toBe(true)
    }
  })

  it('opens a Private profile only to approved followers, linked CFIs and club staff', () => {
    const o = owner({ profileLevel: 'private' })
    expect(canSeeProfile(world(o), 'viewer', 'owner')).toBe(false)
    expect(canSeeProfile(world(o, { follows: [follow('viewer', 'owner', 'pending')] }), 'viewer', 'owner')).toBe(false)
    expect(canSeeProfile(world(o, { follows: [follow('viewer', 'owner')] }), 'viewer', 'owner')).toBe(true)
    const link = { id: 'l', cfiId: 'acct-cfi', studentId: 'owner', status: 'active' as const, since: '2026-01-01' }
    expect(canSeeProfile(world(o, { cfiLinks: [link] }), 'acct-cfi', 'owner')).toBe(true)
    const club = makeClub()
    const memberships = [
      makeMembership({ id: 'm1', accountId: 'owner' }),
      makeMembership({ id: 'm2', accountId: 'viewer', roles: ['admin'] }),
    ]
    expect(canSeeProfile(world(o, { clubs: [club], memberships }), 'viewer', 'owner')).toBe(true)
  })

  it('treats every minor as Private and never discoverable, whatever is stored', () => {
    const minor = owner({ isMinor: true, profileLevel: 'discoverable' })
    expect(effectiveLevel(minor)).toBe('private')
    expect(isDiscoverable(minor)).toBe(false)
    expect(canSeeProfile(world(minor), 'viewer', 'owner')).toBe(false)
    expect(fieldVisibility(minor, 'homeAirport')).toBe('followers')
  })

  it('hides both people from each other after a block', () => {
    const blocks = [{ blockerId: 'owner', blockedId: 'viewer', at: '2026-11-01T00:00:00.000Z' }]
    const w = world(owner({ profileLevel: 'discoverable' }), { blocks })
    expect(canSeeProfile(w, 'viewer', 'owner')).toBe(false)
    expect(canSeeProfile(w, 'owner', 'viewer')).toBe(false)
  })
})

describe('field visibility', () => {
  it('uses the brief defaults: hours for followers, home airport public', () => {
    const o = owner()
    expect(canSeeField(world(o), 'viewer', o, 'homeAirport')).toBe(true)
    expect(canSeeField(world(o), 'viewer', o, 'totalHours')).toBe(false)
    expect(canSeeField(world(o, { follows: [follow('viewer', 'owner')] }), 'viewer', o, 'totalHours')).toBe(true)
  })

  it('honors club and private settings, and always shows the owner everything', () => {
    const o = owner({ visibility: { certificates: 'club', homeAirport: 'private' } })
    const memberships = [makeMembership({ id: 'm1', accountId: 'owner' }), makeMembership({ id: 'm2', accountId: 'viewer' })]
    expect(canSeeField(world(o), 'viewer', o, 'certificates')).toBe(false)
    expect(canSeeField(world(o, { clubs: [makeClub()], memberships }), 'viewer', o, 'certificates')).toBe(true)
    expect(canSeeField(world(o), 'viewer', o, 'homeAirport')).toBe(false)
    expect(canSeeField(world(o), 'owner', o, 'homeAirport')).toBe(true)
  })
})

describe('canViewFlight', () => {
  it('follows the post audience: public, followers, private', () => {
    const o = owner()
    const w = (extra: Partial<World> = {}) => world(o, extra)
    expect(canViewFlight(w(), makeFlight({ pilotId: 'owner' }), 'viewer')).toBe(true)
    expect(canViewFlight(w(), makeFlight({ pilotId: 'owner', postVisibility: 'followers' }), 'viewer')).toBe(false)
    expect(canViewFlight(w({ follows: [follow('viewer', 'owner')] }), makeFlight({ pilotId: 'owner', postVisibility: 'followers' }), 'viewer')).toBe(true)
    expect(canViewFlight(w({ follows: [follow('viewer', 'owner')] }), makeFlight({ pilotId: 'owner', postVisibility: 'private' }), 'viewer')).toBe(false)
  })

  it("keeps a Private pilot's public posts to approved followers", () => {
    const o = owner({ profileLevel: 'private' })
    expect(canViewFlight(world(o), makeFlight({ pilotId: 'owner' }), 'viewer')).toBe(false)
  })

  it('shows a flight to the tagged instructor (to accept or debrief) unless they declined', () => {
    const o = owner()
    const f = (status: 'pending' | 'accepted' | 'declined') =>
      makeFlight({ pilotId: 'owner', postVisibility: 'private', instructor: { accountId: 'acct-cfi', status } })
    expect(canViewFlight(world(o), f('pending'), 'acct-cfi')).toBe(true)
    expect(canViewFlight(world(o), f('accepted'), 'acct-cfi')).toBe(true)
    expect(canViewFlight(world(o), f('declined'), 'acct-cfi')).toBe(false)
  })

  it('shows a club-tagged flight to that club’s staff, not to other members', () => {
    const o = owner({ profileLevel: 'private' })
    const memberships = [
      makeMembership({ id: 'm1', accountId: 'owner' }),
      makeMembership({ id: 'm2', accountId: 'acct-cfi', roles: ['staff_cfi'] }),
      makeMembership({ id: 'm3', accountId: 'viewer' }),
    ]
    const w = world(o, { clubs: [makeClub()], memberships })
    const f = makeFlight({ pilotId: 'owner', clubId: 'club-test', postVisibility: 'private' })
    expect(canViewFlight(w, f, 'acct-cfi')).toBe(true)
    expect(canViewFlight(w, f, 'viewer')).toBe(false)
  })

  it('hides every flight across a block', () => {
    const blocks = [{ blockerId: 'viewer', blockedId: 'owner', at: '2026-11-01T00:00:00.000Z' }]
    expect(canViewFlight(world(owner(), { blocks }), makeFlight({ pilotId: 'owner' }), 'viewer')).toBe(false)
  })
})
