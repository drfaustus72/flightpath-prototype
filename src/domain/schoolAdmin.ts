import { canConfirmSimSession } from './achievements'
import { pendingJoinRequests } from './clubOps'
import { type MissionToVerify, missionsToVerify } from './missions'
import type { Club, Flight, Membership, World } from './types'
import { adminClubsOf } from './world'

/** What waits for a school admin at each school they manage. */
export interface SchoolQueue {
  club: Club
  joinRequests: Membership[]
  missions: MissionToVerify[]
  simSessions: Flight[]
}

export function schoolQueue(world: World, accountId: string, club: Club): SchoolQueue {
  return {
    club,
    joinRequests: pendingJoinRequests(world, club.id),
    missions: missionsToVerify(world, accountId).filter((x) =>
      x.kind === 'tracked' ? x.flight.clubId === club.id : x.clubs.some((c) => c.id === club.id),
    ),
    simSessions: world.flights.filter(
      (f) => f.clubId === club.id && f.simConfirmation?.status === 'pending' && canConfirmSimSession(f, accountId, world.memberships),
    ),
  }
}

export function schoolQueues(world: World, accountId: string): SchoolQueue[] {
  return adminClubsOf(world, accountId).map((club) => schoolQueue(world, accountId, club))
}

export function schoolQueueCount(q: SchoolQueue): number {
  return q.joinRequests.length + q.missions.length + q.simSessions.length
}
