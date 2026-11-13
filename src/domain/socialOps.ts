import { DEBRIEF_MAX } from './schemas'
import { milestoneAchievementCode, milestoneTitle } from './milestones'
import {
  canReadDebrief,
  canRequestSignoff,
  canRevoke,
  canSignOffFlight,
  canSignOffMilestone,
  signoffClubFor,
} from './signoffs'
import { accountById, canComment, canFollow, canGiveProps, checkCommentText, initialFollowStatus } from './social'
import type { Flight, MilestoneCode, ProfileLevel, Report, World } from './types'

/**
 * State transitions for the social layer and sign-offs. Each takes the world, the acting
 * account and a context (new id, current time), checks the rules, and returns a new world.
 * A rule violation throws: the UI only offers allowed actions, so a throw means a bug.
 */
export interface OpContext {
  id: string
  now: string
}

function flightOrThrow(world: World, flightId: string): Flight {
  const f = world.flights.find((x) => x.id === flightId)
  if (!f) throw new Error(`Unknown flight: ${flightId}`)
  return f
}

function replaceFlight(world: World, flight: Flight): World {
  return { ...world, flights: world.flights.map((f) => (f.id === flight.id ? flight : f)) }
}

export function setProfileLevel(world: World, actorId: string, level: ProfileLevel): World {
  const me = accountById(world, actorId)
  if (!me) throw new Error(`Unknown account: ${actorId}`)
  if (me.isMinor && level !== 'private') throw new Error('Minor accounts stay Private')
  // Going Public or Discoverable auto-approves anyone waiting, as an open profile would have.
  const follows = level === 'private' ? world.follows : world.follows.map((f) => (f.followeeId === actorId ? { ...f, status: 'accepted' as const } : f))
  return { ...world, follows, accounts: world.accounts.map((a) => (a.id === actorId ? { ...a, profileLevel: level } : a)) }
}

export function follow(world: World, actorId: string, targetId: string, ctx: OpContext): World {
  const target = accountById(world, targetId)
  if (!target || !canFollow(world, actorId, targetId)) throw new Error(`Can't follow ${targetId}`)
  return { ...world, follows: [...world.follows, { followerId: actorId, followeeId: targetId, status: initialFollowStatus(target), at: ctx.now }] }
}

/** Unfollow, or cancel a pending request. */
export function unfollow(world: World, actorId: string, targetId: string): World {
  return { ...world, follows: world.follows.filter((f) => !(f.followerId === actorId && f.followeeId === targetId)) }
}

export function answerFollowRequest(world: World, actorId: string, followerId: string, approve: boolean): World {
  const req = world.follows.find((f) => f.followerId === followerId && f.followeeId === actorId && f.status === 'pending')
  if (!req) throw new Error(`No follow request from ${followerId}`)
  return {
    ...world,
    follows: approve
      ? world.follows.map((f) => (f === req ? { ...f, status: 'accepted' as const } : f))
      : world.follows.filter((f) => f !== req),
  }
}

export function toggleProps(world: World, actorId: string, flightId: string, ctx: OpContext): World {
  const given = world.props.some((p) => p.flightId === flightId && p.accountId === actorId)
  if (given) return { ...world, props: world.props.filter((p) => !(p.flightId === flightId && p.accountId === actorId)) }
  if (!canGiveProps(world, actorId, flightOrThrow(world, flightId))) throw new Error("Can't give Props to this flight")
  return { ...world, props: [...world.props, { flightId, accountId: actorId, at: ctx.now }] }
}

export function addComment(world: World, actorId: string, flightId: string, raw: string, ctx: OpContext): World {
  if (!canComment(world, actorId, flightOrThrow(world, flightId))) throw new Error("Can't comment on this flight")
  const check = checkCommentText(raw)
  if (!check.ok) throw new Error(check.error)
  return { ...world, comments: [...world.comments, { id: ctx.id, flightId, authorId: actorId, text: check.text, at: ctx.now }] }
}

/** The tagged instructor or "flew with" person accepts or declines the tag. */
export function answerTag(world: World, actorId: string, flightId: string, accept: boolean): World {
  const f = flightOrThrow(world, flightId)
  const status = accept ? ('accepted' as const) : ('declined' as const)
  if (f.instructor?.accountId === actorId && f.instructor.status === 'pending') {
    return replaceFlight(world, { ...f, instructor: { ...f.instructor, status } })
  }
  if (f.flewWith.some((t) => t.accountId === actorId && t.status === 'pending')) {
    return replaceFlight(world, { ...f, flewWith: f.flewWith.map((t) => (t.accountId === actorId ? { ...t, status } : t)) })
  }
  throw new Error(`No pending tag for ${actorId} on ${flightId}`)
}

export function addDebrief(world: World, actorId: string, flightId: string, raw: string, ctx: OpContext): World {
  const f = flightOrThrow(world, flightId)
  if (!canReadDebrief(actorId, f)) throw new Error('Only the pilot and the instructor can write in this debrief')
  const text = raw.trim()
  if (text.length === 0 || text.length > DEBRIEF_MAX) throw new Error(`A debrief message needs 1 to ${DEBRIEF_MAX} characters`)
  return { ...world, debriefs: [...world.debriefs, { id: ctx.id, flightId, authorId: actorId, text, at: ctx.now }] }
}

export function signOffFlight(world: World, actorId: string, flightId: string, note: string, ctx: OpContext): World {
  const f = flightOrThrow(world, flightId)
  if (!canSignOffFlight(world, actorId, f)) throw new Error("Can't sign off this flight")
  const signoff = {
    id: ctx.id,
    cfiId: actorId,
    studentId: f.pilotId,
    flightId,
    milestone: null,
    clubId: signoffClubFor(world, actorId, f.pilotId)?.id ?? null,
    note: note.trim().slice(0, 500),
    // Flight sign-offs never earn XP; the field matters only for milestones.
    schoolAircraft: false,
    at: ctx.now,
    revoked: null,
  }
  return { ...world, signoffs: [...world.signoffs, signoff] }
}

export function signOffMilestone(
  world: World,
  actorId: string,
  studentId: string,
  milestone: MilestoneCode,
  note: string,
  schoolAircraft: boolean,
  ctx: OpContext,
): World {
  if (!canSignOffMilestone(world, actorId, studentId, milestone)) throw new Error("Can't sign off this milestone")
  const clubId = signoffClubFor(world, actorId, studentId)?.id ?? null
  const signoff = {
    id: ctx.id,
    cfiId: actorId,
    studentId,
    flightId: null,
    milestone,
    clubId,
    note: note.trim().slice(0, 500),
    // "Flown in the school's aircraft" only means something when signing for a school.
    schoolAircraft: clubId !== null && schoolAircraft,
    at: ctx.now,
    revoked: null,
  }
  return {
    ...world,
    signoffs: [...world.signoffs, signoff],
    signoffRequests: world.signoffRequests.map((r) =>
      r.studentId === studentId && r.milestone === milestone && r.status === 'open' ? { ...r, status: 'signed' as const } : r,
    ),
  }
}

export function revokeSignoff(world: World, actorId: string, signoffId: string, reason: string, ctx: OpContext): World {
  const s = world.signoffs.find((x) => x.id === signoffId)
  if (!s || !canRevoke(actorId, s)) throw new Error("Can't revoke this sign-off")
  const why = reason.trim()
  if (why.length === 0) throw new Error('Give a reason for revoking')
  return { ...world, signoffs: world.signoffs.map((x) => (x.id === signoffId ? { ...x, revoked: { at: ctx.now, reason: why.slice(0, 500) } } : x)) }
}

export function requestSignoff(world: World, actorId: string, cfiId: string, milestone: MilestoneCode, ctx: OpContext): World {
  if (!canRequestSignoff(world, actorId, cfiId, milestone)) throw new Error("Can't request this sign-off")
  return {
    ...world,
    signoffRequests: [...world.signoffRequests, { id: ctx.id, studentId: actorId, cfiId, milestone, status: 'open', at: ctx.now }],
  }
}

export function declineSignoffRequest(world: World, actorId: string, requestId: string): World {
  const r = world.signoffRequests.find((x) => x.id === requestId && x.cfiId === actorId && x.status === 'open')
  if (!r) throw new Error(`No open request ${requestId}`)
  return { ...world, signoffRequests: world.signoffRequests.map((x) => (x === r ? { ...x, status: 'declined' as const } : x)) }
}

/** The pilot records a milestone themselves; it shows as self-reported until a CFI signs it off. */
export function claimMilestone(world: World, actorId: string, milestone: MilestoneCode, ctx: OpContext): World {
  const code = milestoneAchievementCode(milestone)
  if (world.achievements.some((a) => a.pilotId === actorId && a.code === code)) throw new Error('Already recorded')
  const achievement = {
    id: ctx.id,
    pilotId: actorId,
    kind: 'milestone' as const,
    code,
    title: milestoneTitle(milestone),
    icao: null,
    flightId: null,
    earnedAt: ctx.now,
  }
  return { ...world, achievements: [...world.achievements, achievement] }
}

/** Blocking removes follows both ways and hides each person from the other. */
export function block(world: World, actorId: string, targetId: string, ctx: OpContext): World {
  if (actorId === targetId || !accountById(world, targetId)) throw new Error(`Can't block ${targetId}`)
  if (world.blocks.some((b) => b.blockerId === actorId && b.blockedId === targetId)) return world
  const between = (f: { followerId: string; followeeId: string }) =>
    (f.followerId === actorId && f.followeeId === targetId) || (f.followerId === targetId && f.followeeId === actorId)
  return {
    ...world,
    follows: world.follows.filter((f) => !between(f)),
    blocks: [...world.blocks, { blockerId: actorId, blockedId: targetId, at: ctx.now }],
  }
}

export function unblock(world: World, actorId: string, targetId: string): World {
  return { ...world, blocks: world.blocks.filter((b) => !(b.blockerId === actorId && b.blockedId === targetId)) }
}

export function report(world: World, actorId: string, target: Report['target'], reason: Report['reason'], ctx: OpContext): World {
  return { ...world, reports: [...world.reports, { id: ctx.id, reporterId: actorId, target, reason, at: ctx.now }] }
}

