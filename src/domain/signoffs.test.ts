import { describe, expect, it } from 'vitest'
import { makeAccount, makeCfi, makeClub, makeFlight, makeMembership, makeWorld } from '../test/factories'
import {
  canReadDebrief,
  canRequestSignoff,
  canRevoke,
  canSignOffFlight,
  canSignOffMilestone,
  inboxCount,
  inboxFor,
  instructorOptions,
  milestonesFor,
  signoffClubFor,
} from './signoffs'
import type { Signoff, World } from './types'

const student = makeAccount({ id: 'stu', handle: 'stu' })
const dan = makeCfi({ id: 'dan', handle: 'dan' })
const unverified = makeCfi({ id: 'unv', handle: 'unv', cfi: { verified: false, ratings: ['CFI'], independent: true, listed: true } })
// A free verified CFI: no CFI Pro, no paid plan. Sign-off authority must still work.
const freeCfi = makeCfi({ id: 'free', handle: 'free', subscription: { pilotPro: false, cfiPro: false } })
const link = (cfiId: string, studentId = 'stu') => ({ id: `l-${cfiId}`, cfiId, studentId, status: 'active' as const, since: '2026-01-01' })
const signoff = (over: Partial<Signoff> = {}): Signoff => ({
  id: 's1',
  cfiId: 'dan',
  studentId: 'stu',
  flightId: null,
  milestone: 'first_solo',
  clubId: null,
  note: '',
  schoolAircraft: false,
  at: '2026-11-01T00:00:00.000Z',
  revoked: null,
  ...over,
})

function world(extra: Partial<World> = {}): World {
  return makeWorld({ accounts: [student, dan, unverified, freeCfi], ...extra })
}

const taught = (cfiId: string, status: 'pending' | 'accepted' = 'accepted') =>
  makeFlight({ id: 'f', pilotId: 'stu', instructor: { accountId: cfiId, status } })

describe('flight sign-off', () => {
  it('lets the accepted instructor sign off, once', () => {
    const f = taught('dan')
    expect(canSignOffFlight(world({ flights: [f] }), 'dan', f)).toBe(true)
    const signed = world({ flights: [f], signoffs: [signoff({ flightId: 'f', milestone: null })] })
    expect(canSignOffFlight(signed, 'dan', f)).toBe(false)
  })

  it('needs the tag accepted, a verified CFI, and never the pilot themselves', () => {
    expect(canSignOffFlight(world(), 'dan', taught('dan', 'pending'))).toBe(false)
    expect(canSignOffFlight(world(), 'unv', taught('unv'))).toBe(false)
    expect(canSignOffFlight(world(), 'stu', makeFlight({ pilotId: 'stu' }))).toBe(false)
    expect(canSignOffFlight(world(), 'free', taught('dan'))).toBe(false)
  })

  it('is never paywalled: a free verified CFI can sign off', () => {
    expect(canSignOffFlight(world(), 'free', taught('free'))).toBe(true)
    expect(canSignOffMilestone(world({ cfiLinks: [link('free')] }), 'free', 'stu', 'first_solo')).toBe(true)
  })
})

describe('milestone sign-off', () => {
  it('needs an active CFI–student link and no active sign-off yet', () => {
    expect(canSignOffMilestone(world(), 'dan', 'stu', 'first_solo')).toBe(false)
    expect(canSignOffMilestone(world({ cfiLinks: [link('dan')] }), 'dan', 'stu', 'first_solo')).toBe(true)
    expect(canSignOffMilestone(world({ cfiLinks: [link('dan')], signoffs: [signoff()] }), 'dan', 'stu', 'first_solo')).toBe(false)
  })

  it('allows a new sign-off after the previous one was revoked', () => {
    const revoked = signoff({ revoked: { at: '2026-11-02T00:00:00.000Z', reason: 'Signed the wrong student' } })
    expect(canSignOffMilestone(world({ cfiLinks: [link('dan')], signoffs: [revoked] }), 'dan', 'stu', 'first_solo')).toBe(true)
  })

  it('never lets a CFI verify themselves', () => {
    expect(canSignOffMilestone(world({ cfiLinks: [link('dan', 'dan')] }), 'dan', 'dan', 'first_solo')).toBe(false)
  })

  it('only the signing CFI can revoke, and only once', () => {
    expect(canRevoke('dan', signoff())).toBe(true)
    expect(canRevoke('free', signoff())).toBe(false)
    expect(canRevoke('dan', signoff({ revoked: { at: '2026-11-02T00:00:00.000Z', reason: 'x' } }))).toBe(false)
  })
})

describe('milestonesFor', () => {
  it('shows self-reported claims and CFI verification separately', () => {
    const claim = {
      id: 'a1',
      pilotId: 'stu',
      kind: 'milestone' as const,
      code: 'milestone:first_solo',
      title: 'First solo',
      icao: null,
      flightId: null,
      earnedAt: '2026-10-01T00:00:00.000Z',
    }
    const ms = milestonesFor(world({ achievements: [claim], signoffs: [signoff({ milestone: 'tailwheel' })] }), 'stu')
    const solo = ms.find((m) => m.code === 'first_solo')
    const tw = ms.find((m) => m.code === 'tailwheel')
    expect(solo?.claim?.id).toBe('a1')
    expect(solo?.signoff).toBeNull()
    expect(tw?.claim).toBeNull()
    expect(tw?.signoff?.id).toBe('s1')
  })
})

describe('requests and debriefs', () => {
  it('lets a student ask a linked CFI once per milestone', () => {
    const w = world({ cfiLinks: [link('dan')] })
    expect(canRequestSignoff(w, 'stu', 'dan', 'first_solo')).toBe(true)
    expect(canRequestSignoff(w, 'stu', 'free', 'first_solo')).toBe(false)
    const open = { id: 'r', studentId: 'stu', cfiId: 'dan', milestone: 'first_solo' as const, status: 'open' as const, at: '2026-11-01T00:00:00.000Z' }
    expect(canRequestSignoff({ ...w, signoffRequests: [open] }, 'stu', 'dan', 'first_solo')).toBe(false)
  })

  it('keeps debriefs between the pilot and the accepted instructor', () => {
    expect(canReadDebrief('stu', taught('dan'))).toBe(true)
    expect(canReadDebrief('dan', taught('dan'))).toBe(true)
    expect(canReadDebrief('dan', taught('dan', 'pending'))).toBe(false)
    expect(canReadDebrief('free', taught('dan'))).toBe(false)
    expect(canReadDebrief('stu', makeFlight({ pilotId: 'stu' }))).toBe(false)
  })
})

describe('instructors and inbox', () => {
  it('offers linked CFIs and staff CFIs of the pilot’s schools, verified only', () => {
    const memberships = [
      makeMembership({ id: 'm1', accountId: 'stu' }),
      makeMembership({ id: 'm2', accountId: 'free', roles: ['staff_cfi'] }),
    ]
    const w = world({ clubs: [makeClub()], memberships, cfiLinks: [link('dan'), link('unv')] })
    expect(instructorOptions(w, 'stu').map((a) => a.id)).toEqual(['dan', 'free'])
    expect(signoffClubFor(w, 'free', 'stu')?.id).toBe('club-test')
    expect(signoffClubFor(w, 'dan', 'stu')).toBeNull()
  })

  it('collects tag requests, flights to sign off, milestone requests and sim sessions', () => {
    const memberships = [
      makeMembership({ id: 'm1', accountId: 'stu' }),
      makeMembership({ id: 'm2', accountId: 'dan', roles: ['staff_cfi'] }),
    ]
    const flights = [
      makeFlight({ id: 'tag', pilotId: 'stu', instructor: { accountId: 'dan', status: 'pending' } }),
      makeFlight({ id: 'sign', pilotId: 'stu', instructor: { accountId: 'dan', status: 'accepted' } }),
      makeFlight({
        id: 'sim',
        pilotId: 'stu',
        isSimulator: true,
        clubId: 'club-test',
        simConfirmation: { status: 'pending', byAccountId: null, at: null },
      }),
    ]
    const request = { id: 'r', studentId: 'stu', cfiId: 'dan', milestone: 'first_solo' as const, status: 'open' as const, at: '2026-11-01T00:00:00.000Z' }
    const inbox = inboxFor(world({ clubs: [makeClub()], memberships, flights, cfiLinks: [link('dan')], signoffRequests: [request] }), 'dan')
    expect(inbox.tagRequests.map((f) => f.id)).toEqual(['tag'])
    expect(inbox.toSignOff.map((f) => f.id)).toEqual(['sign'])
    expect(inbox.milestoneRequests.map((r) => r.id)).toEqual(['r'])
    expect(inbox.simSessions.map((f) => f.id)).toEqual(['sim'])
    expect(inboxCount(inbox)).toBe(4)
  })
})
