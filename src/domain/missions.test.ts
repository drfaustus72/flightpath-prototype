import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { flyLegs, outAndBack } from '../test/flights'
import { canVerifyMission, flightMeetsMission, missionByCode, missionStatus, missionsCompletedOn, missionsToVerify } from './missions'
import type { Flight, Mission, World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}
const mission = (w: World, code: string): Mission => {
  const m = missionByCode(w, code)
  if (!m) throw new Error(`mission ${code} missing`)
  return m
}
const withFlight = (w: World, f: Flight): World => ({ ...w, flights: [...w.flights, f] })

describe('flightMeetsMission', () => {
  const w = seed()
  const catalina = flyLegs(w, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya', clubId: 'club-hfa' })

  it('completes Airport in the Sky with a landing at KAVX, and not with a near miss', () => {
    expect(flightMeetsMission(w, catalina, mission(w, 'airport_in_the_sky'))).toBe(true)
    const torrance = flyLegs(w, outAndBack('KHHR', 'KTOA'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' })
    expect(flightMeetsMission(w, torrance, mission(w, 'airport_in_the_sky'))).toBe(false)
  })

  it('needs a landing more than 50 nm from departure for the coastal cross-country', () => {
    const fromHome = flyLegs(w, outAndBack('KHHR', 'KSBA'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' })
    const shortHop = flyLegs(w, outAndBack('KCMA', 'KSBA'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' })
    expect(flightMeetsMission(w, fromHome, mission(w, 'coastal_xc'))).toBe(true)
    expect(flightMeetsMission(w, shortHop, mission(w, 'coastal_xc'))).toBe(false)
  })

  it('needs three full-stop airports, a 50 nm point and 150 nm for the three-point cross-country', () => {
    const legs = [
      { kind: 'ground' as const, at: 'KHHR', sec: 120 },
      { kind: 'fly' as const, from: 'KHHR', to: 'KCMA', cruiseFt: 4500, kt: 110 },
      { kind: 'ground' as const, at: 'KCMA', sec: 300 },
      { kind: 'fly' as const, from: 'KCMA', to: 'KSBA', cruiseFt: 4500, kt: 110 },
      { kind: 'ground' as const, at: 'KSBA', sec: 300 },
      { kind: 'fly' as const, from: 'KSBA', to: 'KHHR', cruiseFt: 5500, kt: 115 },
      { kind: 'ground' as const, at: 'KHHR', sec: 120 },
    ]
    const triangle = flyLegs(w, legs, '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' })
    expect(flightMeetsMission(w, triangle, mission(w, 'three_point_xc'))).toBe(true)
    expect(flightMeetsMission(w, catalina, mission(w, 'three_point_xc'))).toBe(false)
  })

  it('uses field elevation for High Country (Mammoth yes, Big Bear no)', () => {
    const mammoth = flyLegs(w, outAndBack('KBIH', 'KMMH'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' })
    const bigBear = flyLegs(w, outAndBack('KCNO', 'L35'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' })
    expect(flightMeetsMission(w, mammoth, mission(w, 'high_country'))).toBe(true)
    expect(flightMeetsMission(w, bigBear, mission(w, 'high_country'))).toBe(false)
  })

  it('never counts a simulator session for a mission that is not sim-eligible, even confirmed', () => {
    const sim = { ...flyLegs(w, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya', sim: true, clubId: 'club-hfa' }), simConfirmation: { status: 'confirmed' as const, byAccountId: 'acct-dan', at: '2026-11-14T20:00:00.000Z' } }
    expect(flightMeetsMission(w, sim, mission(w, 'airport_in_the_sky'))).toBe(false)
    expect(flightMeetsMission(w, sim, { ...mission(w, 'airport_in_the_sky'), simEligible: true })).toBe(true)
  })

  it('never detects a CFI-only mission from a track', () => {
    expect(flightMeetsMission(w, catalina, mission(w, 'practice_diversion'))).toBe(false)
  })

  it('reports the first flight that completed a mission', () => {
    const w2 = withFlight(w, catalina)
    expect(missionsCompletedOn(w2, catalina).map((m) => m.code)).toEqual(['airport_in_the_sky'])
    expect(missionStatus(w2, 'acct-maya', mission(w2, 'airport_in_the_sky')).complete).toBe(true)
  })
})

describe('verifying missions', () => {
  const base = seed()
  const tagged = flyLegs(base, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya', clubId: 'club-hfa' })
  const untagged = flyLegs(base, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya', clubId: null })
  const w = withFlight(base, tagged)
  const sky = mission(w, 'airport_in_the_sky')

  it('lets the School Pro school’s admin and staff CFIs verify, never the pilot or outsiders', () => {
    expect(canVerifyMission(w, 'acct-alex', tagged, sky)).toBe(true)
    expect(canVerifyMission(w, 'acct-dan', tagged, sky)).toBe(true)
    expect(canVerifyMission(w, 'acct-maya', tagged, sky)).toBe(false)
    expect(canVerifyMission(w, 'acct-kim', tagged, sky)).toBe(false)
    expect(canVerifyMission(withFlight(base, untagged), 'acct-alex', untagged, sky)).toBe(false)
  })

  it('verifies only once', () => {
    const verified: World = {
      ...w,
      missionVerifications: [...w.missionVerifications, { id: 'v', pilotId: 'acct-maya', missionCode: sky.code, flightId: tagged.id, clubId: 'club-hfa', byAccountId: 'acct-alex', at: '2026-11-14T21:00:00.000Z', revoked: null }],
    }
    expect(canVerifyMission(verified, 'acct-dan', tagged, sky)).toBe(false)
  })

  it('lets only the accepted instructor verify a CFI-only mission, on a real flight', () => {
    const diversion = mission(w, 'practice_diversion')
    const dual = { ...tagged, id: 'dual', instructor: { accountId: 'acct-dan', status: 'accepted' as const } }
    expect(canVerifyMission(w, 'acct-dan', dual, diversion)).toBe(true)
    expect(canVerifyMission(w, 'acct-alex', dual, diversion)).toBe(false)
    expect(canVerifyMission(w, 'acct-dan', { ...dual, instructor: { accountId: 'acct-dan', status: 'pending' } }, diversion)).toBe(false)
  })

  it('lists missions waiting for a school staff member', () => {
    expect(missionsToVerify(w, 'acct-alex').map((x) => `${x.flight.pilotId}:${x.mission.code}`)).toContain('acct-maya:airport_in_the_sky')
    expect(missionsToVerify(w, 'acct-kim')).toEqual([])
  })
})
