import { NUDGE_MAX } from './schemas'
import type { OpContext } from './socialOps'
import { accessContextFor, canInClub, type ClubFeature } from './tiers'
import type { Nudge, World } from './types'

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
