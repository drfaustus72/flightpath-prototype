import { NUDGE_MAX } from './schemas'
import type { OpContext } from './socialOps'
import { accessContextFor, canInClub, type ClubFeature, clubOffers } from './tiers'
import type { Account, Flight, Mission, MissionVerification, Nudge, RepostRequest, World } from './types'

function requireInClub(world: World, actorId: string, feature: ClubFeature, clubId: string) {
  const ctx = accessContextFor(world, actorId)
  if (!ctx || !canInClub(ctx, feature, clubId)) throw new Error('You can’t do that for this school')
}

function activePilotMember(world: World, clubId: string, accountId: string) {
  const m = world.memberships.find((x) => x.clubId === clubId && x.accountId === accountId && x.status === 'active' && x.roles.includes('member'))
  if (!m) throw new Error('That pilot isn’t a member of this school')
  return m
}

/** The pilot's nudge from this school that they haven't dismissed, if any. */
export function openNudge(world: World, clubId: string, pilotId: string): Nudge | undefined {
  return world.nudges.find((n) => n.clubId === clubId && n.toAccountId === pilotId && n.dismissedAt === null)
}

/** Nudges waiting on the pilot's Progress, newest first. */
export function nudgesFor(world: World, pilotId: string): Nudge[] {
  return world.nudges.filter((n) => n.toAccountId === pilotId && n.dismissedAt === null).sort((a, b) => b.at.localeCompare(a.at))
}

/**
 * A school's staff send a member a short note, optionally suggesting a mission. One open nudge per
 * pilot per school, so a pilot is never flooded: the pilot dismisses it before another can come.
 */
export function sendNudge(
  world: World,
  actorId: string,
  args: { clubId: string; pilotId: string; message: string; missionCode: string | null },
  ctx: OpContext,
): World {
  requireInClub(world, actorId, 'school.nudges', args.clubId)
  if (args.pilotId === actorId) throw new Error('You can’t nudge yourself')
  activePilotMember(world, args.clubId, args.pilotId)
  const message = args.message.trim()
  if (message.length === 0 || message.length > NUDGE_MAX) throw new Error(`Write a short note (up to ${NUDGE_MAX} characters)`)
  if (args.missionCode !== null && !world.missions.some((m) => m.code === args.missionCode)) throw new Error('Unknown mission')
  if (openNudge(world, args.clubId, args.pilotId)) throw new Error('This pilot already has a note from the school they haven’t seen yet')
  const nudge: Nudge = {
    id: ctx.id,
    clubId: args.clubId,
    fromAccountId: actorId,
    toAccountId: args.pilotId,
    message,
    missionCode: args.missionCode,
    at: ctx.now,
    dismissedAt: null,
  }
  return { ...world, nudges: [...world.nudges, nudge] }
}

export function dismissNudge(world: World, actorId: string, nudgeId: string, ctx: OpContext): World {
  const nudge = world.nudges.find((n) => n.id === nudgeId)
  if (!nudge || nudge.toAccountId !== actorId) throw new Error('Note not found')
  if (nudge.dismissedAt !== null) return world
  return { ...world, nudges: world.nudges.map((n) => (n === nudge ? { ...n, dismissedAt: ctx.now } : n)) }
}

/** A School Pro admin gives a member a sponsored Pilot Pro seat, or takes it back. */
export function setSponsoredSeat(world: World, actorId: string, args: { clubId: string; pilotId: string; on: boolean }): World {
  requireInClub(world, actorId, 'school.sponsorSeats', args.clubId)
  const m = activePilotMember(world, args.clubId, args.pilotId)
  if (m.sponsoredPilotPro === args.on) return world
  return { ...world, memberships: world.memberships.map((x) => (x === m ? { ...x, sponsoredPilotPro: args.on } : x)) }
}

/** Sponsored seats a school is paying for. */
export function sponsoredSeatCount(world: World, clubId: string): number {
  return world.memberships.filter((m) => m.clubId === clubId && m.status === 'active' && m.sponsoredPilotPro).length
}

// --- Mission Wall -----------------------------------------------------------------------------

export interface WallItem {
  request: RepostRequest
  verification: MissionVerification
  mission: Mission
  flight: Flight
  pilot: Account
}

/**
 * School-verified missions the school could ask to feature: a tracked flight, an adult pilot who is
 * still a member, and no earlier request (a pilot who declined or took a card down isn't asked again).
 */
export function wallCandidates(world: World, clubId: string): MissionVerification[] {
  return world.missionVerifications.filter((v) => {
    if (v.clubId !== clubId || v.revoked !== null || v.flightId === null) return false
    const pilot = world.accounts.find((a) => a.id === v.pilotId)
    if (!pilot || pilot.isMinor) return false
    if (!world.memberships.some((m) => m.clubId === clubId && m.accountId === v.pilotId && m.status === 'active')) return false
    return !world.repostRequests.some((r) => r.verificationId === v.id)
  })
}

export function requestRepost(world: World, actorId: string, verificationId: string, ctx: OpContext): World {
  const v = world.missionVerifications.find((x) => x.id === verificationId)
  if (!v || v.clubId === null) throw new Error('Mission not found')
  requireInClub(world, actorId, 'school.repostRequests', v.clubId)
  if (!wallCandidates(world, v.clubId).includes(v)) throw new Error('This mission can’t be featured')
  const request: RepostRequest = {
    id: ctx.id,
    clubId: v.clubId,
    verificationId: v.id,
    pilotId: v.pilotId,
    requestedBy: actorId,
    status: 'pending',
    at: ctx.now,
    answeredAt: null,
  }
  return { ...world, repostRequests: [...world.repostRequests, request] }
}

/** The pilot says yes or no. Only the pilot can. */
export function answerRepost(world: World, actorId: string, requestId: string, approve: boolean, ctx: OpContext): World {
  const r = world.repostRequests.find((x) => x.id === requestId)
  if (!r || r.pilotId !== actorId) throw new Error('Request not found')
  if (r.status !== 'pending') throw new Error('This request was already answered')
  const status = approve ? ('approved' as const) : ('declined' as const)
  return { ...world, repostRequests: world.repostRequests.map((x) => (x === r ? { ...x, status, answeredAt: ctx.now } : x)) }
}

/** The pilot takes their card down, or the school withdraws its request or removes the card. */
export function removeRepost(world: World, actorId: string, requestId: string, ctx: OpContext): World {
  const r = world.repostRequests.find((x) => x.id === requestId)
  if (!r) throw new Error('Request not found')
  const access = accessContextFor(world, actorId)
  const isSchool = access !== null && canInClub(access, 'school.repostRequests', r.clubId)
  if (r.pilotId !== actorId && !isSchool) throw new Error('You can’t do that for this school')
  if (r.status !== 'pending' && r.status !== 'approved') return world
  return { ...world, repostRequests: world.repostRequests.map((x) => (x === r ? { ...x, status: 'withdrawn' as const, answeredAt: ctx.now } : x)) }
}

/** Requests waiting for this pilot's answer. */
export function repostRequestsFor(world: World, pilotId: string): RepostRequest[] {
  return world.repostRequests.filter((r) => r.pilotId === pilotId && r.status === 'pending' && !isMinor(world, pilotId))
}

function isMinor(world: World, accountId: string): boolean {
  return world.accounts.find((a) => a.id === accountId)?.isMinor ?? true
}

function wallItem(world: World, request: RepostRequest): WallItem[] {
  const verification = world.missionVerifications.find((v) => v.id === request.verificationId)
  if (!verification || verification.revoked !== null || verification.flightId === null) return []
  const mission = world.missions.find((m) => m.code === verification.missionCode)
  const flight = world.flights.find((f) => f.id === verification.flightId)
  const pilot = world.accounts.find((a) => a.id === request.pilotId)
  if (!mission || !flight || !pilot || pilot.isMinor) return []
  return [{ request, verification, mission, flight, pilot }]
}

/** The school's public Mission Wall: approved cards whose verification still stands, newest first. */
export function missionWall(world: World, clubId: string): WallItem[] {
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club || !clubOffers(club, 'school.missionWall')) return []
  return world.repostRequests
    .filter((r) => r.clubId === clubId && r.status === 'approved')
    .flatMap((r) => wallItem(world, r))
    .sort((a, b) => (b.request.answeredAt ?? b.request.at).localeCompare(a.request.answeredAt ?? a.request.at))
}

/** Requests the school is waiting on, for its staff. */
export function pendingReposts(world: World, clubId: string): WallItem[] {
  return world.repostRequests.filter((r) => r.clubId === clubId && r.status === 'pending').flatMap((r) => wallItem(world, r))
}
