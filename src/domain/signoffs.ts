import { canConfirmSimSession } from './achievements'
import { MILESTONES, milestoneAchievementCode } from './milestones'
import { isVerifiedCfi } from './tiers'
import type { Account, Achievement, Club, Flight, MilestoneCode, Signoff, SignoffRequest, World } from './types'
import { isBlocked, isInstructorOf } from './visibility'

/**
 * CFI sign-off rules (CLAUDE.md rule 3). Authority is never paywalled: any verified CFI can sign
 * off flights they instructed and milestones for linked students. Nobody verifies themselves.
 * Every sign-off is logged and revocable by the CFI who made it, with a reason.
 */

function cfi(world: World, id: string): Account | undefined {
  const a = world.accounts.find((x) => x.id === id)
  return a && isVerifiedCfi(a) ? a : undefined
}

/** CFIs a pilot can tag as instructor: linked CFIs first, then staff CFIs of the pilot's clubs. */
export function instructorOptions(world: World, pilotId: string): Account[] {
  const linked = world.cfiLinks.filter((l) => l.studentId === pilotId && l.status === 'active').map((l) => l.cfiId)
  const clubs = new Set(world.memberships.filter((m) => m.accountId === pilotId && m.status === 'active').map((m) => m.clubId))
  const staff = world.memberships
    .filter((m) => clubs.has(m.clubId) && m.status === 'active' && m.roles.includes('staff_cfi'))
    .map((m) => m.accountId)
  return [...new Set([...linked, ...staff])]
    .filter((id) => id !== pilotId && !isBlocked(world, id, pilotId))
    .flatMap((id) => cfi(world, id) ?? [])
}

export function canTagInstructor(world: World, pilotId: string, cfiId: string): boolean {
  return cfiId !== pilotId && cfi(world, cfiId) !== undefined && !isBlocked(world, pilotId, cfiId)
}

export function activeSignoffForFlight(world: World, flightId: string): Signoff | undefined {
  return world.signoffs.find((s) => s.flightId === flightId && s.revoked === null)
}

export function activeSignoffForMilestone(world: World, studentId: string, milestone: MilestoneCode): Signoff | undefined {
  return world.signoffs.find((s) => s.studentId === studentId && s.milestone === milestone && s.revoked === null)
}

function isAcceptedInstructor(flight: Flight, accountId: string): boolean {
  return flight.instructor?.accountId === accountId && flight.instructor.status === 'accepted'
}

export function canSignOffFlight(world: World, cfiId: string, flight: Flight): boolean {
  if (!cfi(world, cfiId) || cfiId === flight.pilotId) return false
  return isAcceptedInstructor(flight, cfiId) && activeSignoffForFlight(world, flight.id) === undefined
}

export function canSignOffMilestone(world: World, cfiId: string, studentId: string, milestone: MilestoneCode): boolean {
  if (!cfi(world, cfiId) || cfiId === studentId) return false
  return isInstructorOf(world, cfiId, studentId) && activeSignoffForMilestone(world, studentId, milestone) === undefined
}

export function canRevoke(cfiId: string, signoff: Signoff): boolean {
  return signoff.cfiId === cfiId && signoff.revoked === null
}

/** The school a CFI signs for: one where they are staff CFI and the student is a member, if any. */
export function signoffClubFor(world: World, cfiId: string, studentId: string): Club | null {
  const studentClubs = new Set(world.memberships.filter((m) => m.accountId === studentId && m.status === 'active').map((m) => m.clubId))
  const m = world.memberships.find(
    (x) => x.accountId === cfiId && x.status === 'active' && x.roles.includes('staff_cfi') && studentClubs.has(x.clubId),
  )
  return m ? (world.clubs.find((c) => c.id === m.clubId) ?? null) : null
}

/** Pilot and accepted instructor only: debriefs are private, and need an accepted instructor to exist. */
export function canReadDebrief(accountId: string, flight: Flight): boolean {
  if (flight.instructor?.status !== 'accepted') return false
  return accountId === flight.pilotId || isAcceptedInstructor(flight, accountId)
}

/** CFIs a student can ask to verify a milestone: their actively linked CFIs. */
export function linkedCfisOf(world: World, studentId: string): Account[] {
  return world.cfiLinks
    .filter((l) => l.studentId === studentId && l.status === 'active')
    .flatMap((l) => cfi(world, l.cfiId) ?? [])
}

export function linkedStudentsOf(world: World, cfiId: string): Account[] {
  const ids = world.cfiLinks.filter((l) => l.cfiId === cfiId && l.status === 'active').map((l) => l.studentId)
  return world.accounts.filter((a) => ids.includes(a.id))
}

export function openRequestFor(world: World, studentId: string, milestone: MilestoneCode): SignoffRequest | undefined {
  return world.signoffRequests.find((r) => r.studentId === studentId && r.milestone === milestone && r.status === 'open')
}

export function canRequestSignoff(world: World, studentId: string, cfiId: string, milestone: MilestoneCode): boolean {
  return (
    isInstructorOf(world, cfiId, studentId) &&
    cfi(world, cfiId) !== undefined &&
    activeSignoffForMilestone(world, studentId, milestone) === undefined &&
    openRequestFor(world, studentId, milestone) === undefined
  )
}

export interface MilestoneStatus {
  code: MilestoneCode
  title: string
  /** The pilot's own entry, shown as self-reported. */
  claim: Achievement | null
  /** An active CFI sign-off, shown as CFI-verified. */
  signoff: Signoff | null
  request: SignoffRequest | null
}

export function milestonesFor(world: World, pilotId: string): MilestoneStatus[] {
  return MILESTONES.map(({ code, title }) => ({
    code,
    title,
    claim: world.achievements.find((a) => a.pilotId === pilotId && a.code === milestoneAchievementCode(code)) ?? null,
    signoff: activeSignoffForMilestone(world, pilotId, code) ?? null,
    request: openRequestFor(world, pilotId, code) ?? null,
  }))
}

export interface CfiInbox {
  /** Flights where a pilot tagged this CFI as instructor and is waiting for an answer. */
  tagRequests: Flight[]
  /** Flights this CFI instructed that don't have a sign-off yet. */
  toSignOff: Flight[]
  milestoneRequests: SignoffRequest[]
  /** Simulator sessions tagged to a school where this CFI is admin or staff, waiting for confirmation. */
  simSessions: Flight[]
}

export function inboxFor(world: World, cfiId: string): CfiInbox {
  const newest = (a: Flight, b: Flight) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt)
  return {
    tagRequests: world.flights.filter((f) => f.instructor?.accountId === cfiId && f.instructor.status === 'pending').sort(newest),
    toSignOff: world.flights.filter((f) => canSignOffFlight(world, cfiId, f)).sort(newest),
    milestoneRequests: world.signoffRequests.filter(
      (r) => r.cfiId === cfiId && r.status === 'open' && canSignOffMilestone(world, cfiId, r.studentId, r.milestone),
    ),
    simSessions: world.flights
      .filter((f) => f.simConfirmation?.status === 'pending' && canConfirmSimSession(f, cfiId, world.memberships))
      .sort(newest),
  }
}

export function inboxCount(inbox: CfiInbox): number {
  return inbox.tagRequests.length + inbox.toSignOff.length + inbox.milestoneRequests.length + inbox.simSessions.length
}
