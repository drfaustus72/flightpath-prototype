import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { requestJoin } from './clubOps'
import { schoolQueueCount, schoolQueues } from './schoolAdmin'
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

  it('is empty for pilots who manage no school', () => {
    expect(schoolQueues(seed(), 'acct-jordan')).toEqual([])
  })
})
