import { offersSchoolPlans } from './clubs'
import type { OpContext } from './socialOps'
import type { Club, Membership, World } from './types'

/**
 * Joining, leaving and claiming schools and clubs. Rule violations throw (see socialOps).
 *  - A claimed school approves join requests; an unclaimed page has no one to approve, so the
 *    affiliation is recorded right away and shown as self-reported until the school claims it.
 *  - Leaving keeps the history (status "former"); XP stays with the school (CLAUDE.md rule 2).
 */

const today = (ctx: OpContext) => ctx.now.slice(0, 10)

function clubOrThrow(world: World, clubId: string): Club {
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club) throw new Error(`Unknown club ${clubId}`)
  return club
}

export function currentMembership(world: World, accountId: string, clubId: string): Membership | undefined {
  return world.memberships.find((m) => m.accountId === accountId && m.clubId === clubId && m.status !== 'former')
}

export function isAdminOf(world: World, accountId: string, clubId: string): boolean {
  const club = world.clubs.find((c) => c.id === clubId)
  return (
    club?.claimed === true &&
    world.memberships.some((m) => m.accountId === accountId && m.clubId === clubId && m.status === 'active' && m.roles.includes('admin'))
  )
}

/** Affiliations with an unclaimed page are self-reported: nobody at the school has confirmed them. */
export function isSelfReportedAffiliation(world: World, membership: Membership): boolean {
  return world.clubs.find((c) => c.id === membership.clubId)?.claimed === false
}

export function requestJoin(world: World, actorId: string, clubId: string, ctx: OpContext): World {
  const club = clubOrThrow(world, clubId)
  if (currentMembership(world, actorId, clubId)) throw new Error('Already a member or waiting for approval')
  const membership: Membership = {
    id: ctx.id,
    accountId: actorId,
    clubId,
    roles: ['member'],
    status: club.claimed ? 'pending' : 'active',
    isHomeSchool: false,
    sponsoredPilotPro: false,
    startedOn: today(ctx),
    endedOn: null,
  }
  return { ...world, memberships: [...world.memberships, membership] }
}

export function cancelJoinRequest(world: World, actorId: string, clubId: string): World {
  return { ...world, memberships: world.memberships.filter((m) => !(m.accountId === actorId && m.clubId === clubId && m.status === 'pending')) }
}

export function pendingJoinRequests(world: World, clubId: string): Membership[] {
  return world.memberships.filter((m) => m.clubId === clubId && m.status === 'pending')
}

export function answerJoinRequest(world: World, actorId: string, membershipId: string, approve: boolean, ctx: OpContext): World {
  const m = world.memberships.find((x) => x.id === membershipId && x.status === 'pending')
  if (!m || !isAdminOf(world, actorId, m.clubId)) throw new Error("Can't answer this request")
  return {
    ...world,
    memberships: approve
      ? world.memberships.map((x) => (x === m ? { ...x, status: 'active' as const, startedOn: today(ctx) } : x))
      : world.memberships.filter((x) => x !== m),
  }
}

export function leaveClub(world: World, actorId: string, clubId: string, ctx: OpContext): World {
  const m = world.memberships.find((x) => x.accountId === actorId && x.clubId === clubId && x.status === 'active')
  if (!m) throw new Error('Not a member')
  const otherAdmins = world.memberships.filter(
    (x) => x.clubId === clubId && x.status === 'active' && x.roles.includes('admin') && x.accountId !== actorId,
  )
  if (m.roles.includes('admin') && otherAdmins.length === 0) throw new Error('Add another admin before you leave')
  return {
    ...world,
    memberships: world.memberships.map((x) =>
      x === m ? { ...x, status: 'former' as const, endedOn: today(ctx), isHomeSchool: false, sponsoredPilotPro: false } : x,
    ),
  }
}

export function setHomeSchool(world: World, actorId: string, clubId: string): World {
  const club = clubOrThrow(world, clubId)
  if (!offersSchoolPlans(club)) throw new Error('A home school must be a flight school or flying club')
  if (!world.memberships.some((m) => m.accountId === actorId && m.clubId === clubId && m.status === 'active')) {
    throw new Error('Join the school first')
  }
  return {
    ...world,
    memberships: world.memberships.map((m) =>
      m.accountId === actorId && m.status === 'active' ? { ...m, isHomeSchool: m.clubId === clubId } : m,
    ),
  }
}

/** The host part of a school's website, e.g. "desertwings.example". */
export function claimDomain(club: Club): string | null {
  if (!club.website) return null
  return new URL(club.website).hostname.replace(/^www\./, '')
}

export type ClaimCheck = { ok: true } | { ok: false; error: string }

/** Prototype stand-in for real claim verification: an email address at the school's own domain. */
export function checkClaimEmail(club: Club, email: string): ClaimCheck {
  const domain = claimDomain(club)
  if (!domain) return { ok: false, error: 'This page has no website on file, so it needs a manual review.' }
  const at = email.trim().toLowerCase().split('@')
  if (at.length !== 2 || !at[0]) return { ok: false, error: 'Enter an email address, for example name@' + domain + '.' }
  if (at[1] !== domain) return { ok: false, error: `Use an email address at ${domain}, the school’s website.` }
  return { ok: true }
}

export function claimClub(world: World, actorId: string, clubId: string, email: string, ctx: OpContext): World {
  const club = clubOrThrow(world, clubId)
  if (club.claimed) throw new Error('Already claimed')
  if (!offersSchoolPlans(club)) throw new Error('Community clubs have no school page to claim')
  const check = checkClaimEmail(club, email)
  if (!check.ok) throw new Error(check.error)
  const existing = currentMembership(world, actorId, clubId)
  const memberships = existing
    ? world.memberships.map((m) => (m === existing ? { ...m, status: 'active' as const, roles: [...new Set([...m.roles, 'admin' as const])] } : m))
    : [
        ...world.memberships,
        {
          id: ctx.id,
          accountId: actorId,
          clubId,
          roles: ['admin' as const],
          status: 'active' as const,
          isHomeSchool: false,
          sponsoredPilotPro: false,
          startedOn: today(ctx),
          endedOn: null,
        },
      ]
  return { ...world, memberships, clubs: world.clubs.map((c) => (c.id === clubId ? { ...c, claimed: true } : c)) }
}

export function setCfiListed(world: World, actorId: string, listed: boolean): World {
  return {
    ...world,
    accounts: world.accounts.map((a) => (a.id === actorId && a.cfi ? { ...a, cfi: { ...a.cfi, listed } } : a)),
  }
}
