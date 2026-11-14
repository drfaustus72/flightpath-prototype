import { canConfirmSimSession } from './achievements'
import { offersSchoolPlans } from './clubs'
import { pendingJoinRequests } from './clubOps'
import { type MissionToVerify, missionsToVerify } from './missions'
import { schoolRolesOf } from './schoolPermissions'
import { accessContextFor, canInClub } from './tiers'
import type { Club, Flight, Membership, World } from './types'

/**
 * Claimed schools and flying clubs where this account is on staff (admin or staff CFI).
 * These are the schools it can act as.
 */
export function staffSchoolsOf(world: World, accountId: string): Club[] {
  const ids = new Set(
    world.memberships
      .filter((m) => m.accountId === accountId && schoolRolesOf(m).length > 0)
      .map((m) => m.clubId),
  )
  return world.clubs.filter((c) => ids.has(c.id) && c.claimed && offersSchoolPlans(c))
}

/** What waits for this staff member at one school. Each part is empty when their role or the plan doesn't cover it. */
export interface SchoolQueue {
  club: Club
  joinRequests: Membership[]
  missions: MissionToVerify[]
  simSessions: Flight[]
}

export function schoolQueue(world: World, accountId: string, club: Club): SchoolQueue {
  const ctx = accessContextFor(world, accountId)
  const allowed = (f: Parameters<typeof canInClub>[1]) => ctx !== null && canInClub(ctx, f, club.id)
  const queueOpen = allowed('school.queue')
  return {
    club,
    joinRequests: allowed('school.approveMembers') ? pendingJoinRequests(world, club.id) : [],
    missions: queueOpen ? missionsAt(world, accountId, club.id) : [],
    simSessions: queueOpen
      ? world.flights.filter(
          (f) => f.clubId === club.id && f.simConfirmation?.status === 'pending' && canConfirmSimSession(f, accountId, world.memberships),
        )
      : [],
  }
}

function missionsAt(world: World, accountId: string, clubId: string): MissionToVerify[] {
  return missionsToVerify(world, accountId).filter((x) => missionClubIds(x).includes(clubId))
}

function missionClubIds(x: MissionToVerify): string[] {
  if (x.kind === 'tracked') return x.flight.clubId === null ? [] : [x.flight.clubId]
  return x.clubs.map((c) => c.id)
}

/**
 * Missions this person can verify that belong to none of their schools (an instructor-only mission
 * on a flight they taught outside a school they staff). These stay in the CFI's own inbox.
 */
export function personalMissionsToVerify(world: World, accountId: string): MissionToVerify[] {
  const schools = new Set(staffSchoolsOf(world, accountId).map((c) => c.id))
  return missionsToVerify(world, accountId).filter((x) => !missionClubIds(x).some((id) => schools.has(id)))
}

export function schoolQueues(world: World, accountId: string): SchoolQueue[] {
  return staffSchoolsOf(world, accountId).map((club) => schoolQueue(world, accountId, club))
}

export function schoolQueueCount(q: SchoolQueue): number {
  return q.joinRequests.length + q.missions.length + q.simSessions.length
}
