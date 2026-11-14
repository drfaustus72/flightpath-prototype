import type { Account, Flight, Membership, World } from './types'
import { xpEntries } from './xp'

/** A member who has flown with the school within this many days counts as active. */
export const ACTIVE_WINDOW_DAYS = 30
const DAY_MS = 86_400_000

/**
 * The moment the dashboard is computed for: the latest flight in the data. Seed data is fixed, so
 * anchoring to it keeps the demo stable whatever day it's shown. Null when there are no flights.
 */
export function dataAsOf(world: World): string | null {
  let latest: string | null = null
  for (const f of world.flights) {
    const at = f.startedAt ?? f.createdAt
    if (latest === null || at > latest) latest = at
  }
  return latest
}

export interface MemberActivity {
  account: Account
  membership: Membership
  /** Last real (non-simulator) flight tagged to this school, up to asOf. */
  lastFlightAt: string | null
  daysSince: number | null
  status: 'active' | 'inactive'
  /** School-tagged flights in the active window. */
  recentFlights: number
  xp: number
}

export interface WeekCount {
  /** First day of the 7-day bucket (ISO date). */
  weekStart: string
  flights: number
}

export interface SchoolDashboard {
  asOf: string
  members: MemberActivity[]
  active: number
  inactive: number
  /** Oldest week first; the last bucket ends at asOf. */
  weekly: WeekCount[]
  missionsVerified: number
  openMilestoneRequests: number
}

/** Real flights a pilot tagged to the school. Simulator sessions don't count as flying with the school. */
function schoolFlights(world: World, clubId: string, asOf: string): Flight[] {
  return world.flights.filter((f) => f.clubId === clubId && !f.isSimulator && f.startedAt !== null && f.startedAt <= asOf)
}

/** Pilot members of the school (staff-only memberships are left out). */
function pilotMemberships(world: World, clubId: string): Membership[] {
  return world.memberships.filter((m) => m.clubId === clubId && m.status === 'active' && m.roles.includes('member'))
}

/**
 * Retention view for a school, computed only from flights pilots chose to tag to the school
 * and from the school's own verifications. Inactive members come first, longest gap first.
 */
export function schoolDashboard(world: World, clubId: string, asOf: string, weeks = 12): SchoolDashboard {
  const asOfMs = Date.parse(asOf)
  const windowStart = new Date(asOfMs - ACTIVE_WINDOW_DAYS * DAY_MS).toISOString()
  const flights = schoolFlights(world, clubId, asOf)

  const members: MemberActivity[] = pilotMemberships(world, clubId).flatMap((membership) => {
    const account = world.accounts.find((a) => a.id === membership.accountId)
    if (!account) return []
    const own = flights.filter((f) => f.pilotId === account.id)
    const last = own.reduce<string | null>((max, f) => (f.startedAt !== null && (max === null || f.startedAt > max) ? f.startedAt : max), null)
    const daysSince = last === null ? null : Math.floor((asOfMs - Date.parse(last)) / DAY_MS)
    const recentFlights = own.filter((f) => f.startedAt !== null && f.startedAt > windowStart).length
    return [
      {
        account,
        membership,
        lastFlightAt: last,
        daysSince,
        status: recentFlights > 0 ? ('active' as const) : ('inactive' as const),
        recentFlights,
        xp: xpEntries(world, account.id, clubId).reduce((sum, e) => sum + e.xp, 0),
      },
    ]
  })
  members.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'inactive' ? -1 : 1
    return (b.daysSince ?? Number.POSITIVE_INFINITY) - (a.daysSince ?? Number.POSITIVE_INFINITY) || a.account.displayName.localeCompare(b.account.displayName)
  })

  const weekly: WeekCount[] = Array.from({ length: weeks }, (_, i) => {
    const end = asOfMs - (weeks - 1 - i) * 7 * DAY_MS
    const start = end - 7 * DAY_MS
    return {
      weekStart: new Date(start).toISOString().slice(0, 10),
      flights: flights.filter((f) => {
        const t = Date.parse(f.startedAt ?? '')
        return t > start && t <= end
      }).length,
    }
  })

  const memberIds = new Set(members.map((m) => m.account.id))
  const staffIds = new Set(
    world.memberships
      .filter((m) => m.clubId === clubId && m.status === 'active' && (m.roles.includes('admin') || m.roles.includes('staff_cfi')))
      .map((m) => m.accountId),
  )

  return {
    asOf,
    members,
    active: members.filter((m) => m.status === 'active').length,
    inactive: members.filter((m) => m.status === 'inactive').length,
    weekly,
    missionsVerified: world.missionVerifications.filter((v) => v.clubId === clubId && v.revoked === null && v.at > windowStart && v.at <= asOf)
      .length,
    openMilestoneRequests: world.signoffRequests.filter((r) => r.status === 'open' && memberIds.has(r.studentId) && staffIds.has(r.cfiId)).length,
  }
}
