import { canVerifyMission, missionByCode, verificationClubId } from './missions'
import type { OpContext } from './socialOps'
import type { World } from './types'

/** State transitions for missions, challenges and no-gos. Rule violations throw (see socialOps). */

export function verifyMission(world: World, actorId: string, flightId: string, missionCode: string, ctx: OpContext): World {
  const flight = world.flights.find((f) => f.id === flightId)
  const mission = missionByCode(world, missionCode)
  if (!flight || !mission || !canVerifyMission(world, actorId, flight, mission)) throw new Error("Can't verify this mission")
  const verification = {
    id: ctx.id,
    pilotId: flight.pilotId,
    missionCode,
    flightId,
    clubId: verificationClubId(world, actorId, flight),
    byAccountId: actorId,
    at: ctx.now,
    revoked: null,
  }
  return { ...world, missionVerifications: [...world.missionVerifications, verification] }
}

/** The verifier, or an admin of the school it was recorded for, can revoke it with a reason. */
export function canRevokeMissionVerification(world: World, actorId: string, verificationId: string): boolean {
  const v = world.missionVerifications.find((x) => x.id === verificationId)
  if (!v || v.revoked !== null) return false
  if (v.byAccountId === actorId) return true
  return world.memberships.some(
    (m) => m.accountId === actorId && m.clubId === v.clubId && m.status === 'active' && m.roles.includes('admin'),
  )
}

export function revokeMissionVerification(world: World, actorId: string, verificationId: string, reason: string, ctx: OpContext): World {
  if (!canRevokeMissionVerification(world, actorId, verificationId)) throw new Error("Can't revoke this verification")
  const why = reason.trim()
  if (why.length === 0) throw new Error('Give a reason for revoking')
  return {
    ...world,
    missionVerifications: world.missionVerifications.map((v) =>
      v.id === verificationId ? { ...v, revoked: { at: ctx.now, reason: why.slice(0, 500) } } : v,
    ),
  }
}

export function joinChallenge(world: World, actorId: string, code: string, ctx: OpContext): World {
  if (!world.challenges.some((c) => c.code === code)) throw new Error(`Unknown challenge ${code}`)
  if (world.challengeEntries.some((e) => e.pilotId === actorId && e.challengeCode === code)) return world
  return { ...world, challengeEntries: [...world.challengeEntries, { pilotId: actorId, challengeCode: code, joinedAt: ctx.now }] }
}

export function leaveChallenge(world: World, actorId: string, code: string): World {
  return { ...world, challengeEntries: world.challengeEntries.filter((e) => !(e.pilotId === actorId && e.challengeCode === code)) }
}

export function recordNoGo(world: World, actorId: string, entry: { from: string; to: string | null; reason: string }, ctx: OpContext): World {
  const reason = entry.reason.trim()
  if (reason.length === 0 || reason.length > 500) throw new Error('Say briefly why you decided not to go (up to 500 characters)')
  const known = new Set(world.airports.map((a) => a.icao))
  if (!known.has(entry.from) || (entry.to !== null && !known.has(entry.to))) throw new Error('Unknown airport')
  return { ...world, noGos: [...world.noGos, { id: ctx.id, pilotId: actorId, from: entry.from, to: entry.to, reason, at: ctx.now }] }
}
