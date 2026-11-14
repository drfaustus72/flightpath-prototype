import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { requestJoin } from './clubOps'
import { personalMissionsToVerify, schoolQueueCount, schoolQueues, staffSchoolsOf } from './schoolAdmin'
import type { World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}

describe('schoolQueues', () => {
  it("collects a school admin's join requests, missions to verify and simulator sessions", () => {
    const w = requestJoin(seed(), 'acct-jordan', 'club-hfa', { id: 'm-new', now: '2026-11-13T18:00:00.000Z' })
    const [hfa] = schoolQueues(w, 'acct-alex')
    expect(hfa?.club.id).toBe('club-hfa')
    expect(hfa?.joinRequests.map((m) => m.accountId)).toEqual(['acct-jordan'])
    // Lena's Redbird session is tagged to Hawthorne and waiting: admins confirm sessions too, not only staff CFIs.
    expect(hfa?.simSessions.map((f) => f.id)).toEqual(['flt-lena-sim'])
    expect(hfa && schoolQueueCount(hfa)).toBe(2)
  })

  it('is empty for pilots on no school staff', () => {
    expect(schoolQueues(seed(), 'acct-jordan')).toEqual([])
    expect(staffSchoolsOf(seed(), 'acct-lena')).toEqual([])
  })

  it('gives a staff CFI the queue but not join requests', () => {
    const w = requestJoin(seed(), 'acct-jordan', 'club-hfa', { id: 'm-new', now: '2026-11-13T18:00:00.000Z' })
    expect(staffSchoolsOf(w, 'acct-dan').map((c) => c.id)).toEqual(['club-hfa'])
    const [hfa] = schoolQueues(w, 'acct-dan')
    expect(hfa?.joinRequests).toEqual([])
    expect(hfa?.simSessions.map((f) => f.id)).toEqual(['flt-lena-sim'])
    expect(hfa?.missions.length).toBe(schoolQueues(w, 'acct-alex')[0]?.missions.length)
  })

  it('keeps no school missions in the CFI inbox once they show in the school queue', () => {
    const w = seed()
    const queued = schoolQueues(w, 'acct-dan').flatMap((q) => q.missions)
    const personal = personalMissionsToVerify(w, 'acct-dan')
    expect(personal.filter((p) => queued.some((q) => q.pilotId === p.pilotId && q.mission.code === p.mission.code))).toEqual([])
  })
})
