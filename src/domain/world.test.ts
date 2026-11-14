import { describe, expect, it } from 'vitest'
import { rawSeed, seedResult } from '../data/seed'
import { accessContextFor, can, canInClub, hasCfiPro, hasPilotPro } from './tiers'
import type { World } from './types'
import { activeMemberCount, adminClubsOf, demoPersonas, homeSchoolOf, loadWorld } from './world'

function seedWorld(): World {
  if (!seedResult.ok) throw new Error(`seed invalid: ${seedResult.errors.join('; ')}`)
  return seedResult.world
}

const clone = (): World => structuredClone(seedWorld())

describe('seed data', () => {
  it('passes schema and integrity validation', () => {
    expect(seedResult.ok ? [] : seedResult.errors).toEqual([])
  })

  it('has four demo personas in a stable order', () => {
    expect(demoPersonas(seedWorld()).map((a) => a.id)).toEqual(['acct-maya', 'acct-dan', 'acct-alex', 'acct-jordan'])
  })

  it('gives each persona the access its demo script needs', () => {
    const world = seedWorld()
    const ctx = (id: string) => {
      const c = accessContextFor(world, id)
      if (!c) throw new Error(`missing ${id}`)
      return c
    }
    expect(hasPilotPro(ctx('acct-maya'))).toBe(true) // sponsored seat
    expect(hasCfiPro(ctx('acct-dan'))).toBe(true) // staff CFI at School Pro
    expect(canInClub(ctx('acct-alex'), 'school.dashboard', 'club-hfa')).toBe(true)
    expect(hasPilotPro(ctx('acct-jordan'))).toBe(false)
    // School Basic admin: page tools only
    expect(canInClub(ctx('acct-kim'), 'school.editPage', 'club-coastal')).toBe(true)
    expect(canInClub(ctx('acct-kim'), 'school.dashboard', 'club-coastal')).toBe(false)
    // Independent CFI without CFI Pro can still sign off
    expect(can(ctx('acct-priya'), 'cfi.signOff')).toBe(true)
    expect(hasCfiPro(ctx('acct-priya'))).toBe(false)
  })

  it('answers home school, member count and admin clubs', () => {
    const world = seedWorld()
    expect(homeSchoolOf(world, 'acct-jordan')?.id).toBe('club-coastal')
    expect(homeSchoolOf(world, 'acct-priya')).toBeNull()
    expect(activeMemberCount(world, 'club-hfa')).toBe(20)
    expect(adminClubsOf(world, 'acct-alex').map((c) => c.id)).toEqual(['club-hfa'])
    expect(adminClubsOf(world, 'acct-maya')).toEqual([])
  })
})

describe('loadWorld', () => {
  it('reports schema errors with their path', () => {
    const result = loadWorld({ ...rawSeed, airports: [{ icao: 'bad' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.startsWith('airports.0'))).toBe(true)
  })

  it('reports referential and business-rule violations', () => {
    const w = clone()
    w.memberships.push({ ...w.memberships[0]!, id: 'mem-x', accountId: 'acct-nobody' })
    const priya = w.accounts.find((a) => a.id === 'acct-priya')
    if (priya) priya.cfi = { verified: false, ratings: ['CFI'], independent: true, listed: true }
    w.memberships.push({ ...w.memberships[0]!, id: 'mem-y', accountId: 'acct-priya', roles: ['staff_cfi'], isHomeSchool: false })
    w.memberships.push({ ...w.memberships[0]!, id: 'mem-z', clubId: 'club-desert', roles: ['admin'], isHomeSchool: false })
    const sam = w.accounts.find((a) => a.id === 'acct-sam')
    if (sam) sam.visibility = { activity: 'public' }

    const result = loadWorld(w)
    expect(result.ok).toBe(false)
    const errors = result.ok ? [] : result.errors
    expect(errors).toContain('membership mem-x: unknown account acct-nobody')
    expect(errors).toContain('membership mem-y: staff_cfi requires a verified CFI account')
    expect(errors).toContain('membership mem-z: an unclaimed school page cannot have admins')
    expect(errors).toContain('account acct-sam: minor accounts must not have public fields')
  })

  it('rejects a second active home school and duplicate active memberships', () => {
    const w = clone()
    w.memberships.push({ ...w.memberships[0]!, id: 'mem-dup' })
    w.memberships.push({ ...w.memberships[0]!, id: 'mem-home2', clubId: 'club-coastal' })
    const result = loadWorld(w)
    const errors = result.ok ? [] : result.errors
    expect(errors).toContain('memberships: more than one active membership for acct-maya→club-hfa')
    expect(errors).toContain('account acct-maya: more than one active home school')
  })
})

describe('social and sign-off integrity', () => {
  const errorsFor = (mutate: (w: World) => void) => {
    const w = clone()
    mutate(w)
    const r = loadWorld(w)
    return r.ok ? [] : r.errors
  }
  const flightOf = (w: World, id: string) => {
    const f = w.flights.find((x) => x.id === id)
    if (!f) throw new Error(`seed flight ${id} missing`)
    return f
  }

  it('keeps every minor Private', () => {
    expect(
      errorsFor((w) => {
        const sam = w.accounts.find((a) => a.id === 'acct-sam')
        if (sam) sam.profileLevel = 'public'
      }),
    ).toContain('account acct-sam: minor accounts must be Private')
  })

  it('rejects self-verification and flight sign-offs by someone other than the accepted instructor', () => {
    const errors = errorsFor((w) => {
      w.signoffs.push(
        { id: 'self', cfiId: 'acct-dan', studentId: 'acct-dan', flightId: null, milestone: 'ipc', clubId: null, note: '', schoolAircraft: false, at: '2026-11-01T00:00:00.000Z', revoked: null },
        { id: 'wrong', cfiId: 'acct-kim', studentId: 'acct-maya', flightId: 'flt-maya-dual-xc', milestone: null, clubId: null, note: '', schoolAircraft: false, at: '2026-11-01T00:00:00.000Z', revoked: null },
      )
    })
    expect(errors).toContain('signoff self: no self-verification')
    expect(errors).toContain("signoff wrong: a flight sign-off needs the flight's accepted instructor and its pilot")
  })

  it('rejects an unverified instructor tag and debriefs from outsiders', () => {
    const errors = errorsFor((w) => {
      flightOf(w, 'flt-lena-sba').instructor = { accountId: 'acct-jordan', status: 'accepted' }
      w.debriefs.push({ id: 'out', flightId: 'flt-maya-pattern', authorId: 'acct-lena', text: 'hi', at: '2026-11-04T00:00:00.000Z' })
    })
    expect(errors).toContain('flight flt-lena-sba: instructor acct-jordan is not a verified CFI')
    expect(errors).toContain('debrief out: only the pilot and the accepted instructor can write in a debrief')
  })

  it('rejects two active sign-offs for the same subject', () => {
    const errors = errorsFor((w) => {
      const first = w.signoffs[0]
      if (first) w.signoffs.push({ ...first, id: 'dup' })
    })
    expect(errors.some((e) => e.startsWith('signoffs: more than one active sign-off'))).toBe(true)
  })
})
