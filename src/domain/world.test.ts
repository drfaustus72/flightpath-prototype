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
    expect(activeMemberCount(world, 'club-hfa')).toBe(5)
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
    if (priya) priya.cfi = { verified: false, ratings: ['CFI'], independent: true }
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
