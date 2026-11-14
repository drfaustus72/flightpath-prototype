import { worldSchema } from './schemas'
import { offersSchoolPlans } from './clubs'
import type { Account, World } from './types'

export type LoadResult = { ok: true; world: World } | { ok: false; errors: string[] }

/**
 * Parses raw seed JSON into a World, checking both shape (zod) and
 * cross-record rules zod can't express. Returns every problem found,
 * so a bad seed edit is diagnosed in one pass.
 */
export function loadWorld(raw: unknown): LoadResult {
  const parsed = worldSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    }
  }
  const errors = checkIntegrity(parsed.data)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, world: parsed.data }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const v of values) (seen.has(v) ? dupes : seen).add(v)
  return [...dupes]
}

export function checkIntegrity(world: World): string[] {
  const errors: string[] = []
  const airports = new Set(world.airports.map((a) => a.icao))
  const accounts = new Map(world.accounts.map((a) => [a.id, a]))
  const clubs = new Map(world.clubs.map((c) => [c.id, c]))

  for (const d of duplicates(world.accounts.map((a) => a.id))) errors.push(`accounts: duplicate id ${d}`)
  for (const d of duplicates(world.accounts.map((a) => a.handle))) errors.push(`accounts: duplicate handle ${d}`)
  for (const d of duplicates(world.clubs.map((c) => c.id))) errors.push(`clubs: duplicate id ${d}`)
  for (const d of duplicates(world.memberships.map((m) => m.id))) errors.push(`memberships: duplicate id ${d}`)
  for (const d of duplicates(world.airports.map((a) => a.icao))) errors.push(`airports: duplicate ${d}`)

  for (const a of world.accounts) {
    if (!airports.has(a.homeAirport)) errors.push(`account ${a.id}: unknown home airport ${a.homeAirport}`)
    if (a.isMinor) {
      const publicFields = Object.entries(a.visibility).filter(([, v]) => v === 'public')
      if (publicFields.length > 0) errors.push(`account ${a.id}: minor accounts must not have public fields`)
    }
  }

  const personaOrders = world.accounts.flatMap((a) => (a.demoPersona ? [String(a.demoPersona.order)] : []))
  if (personaOrders.length === 0) errors.push('accounts: at least one demo persona is required')
  for (const d of duplicates(personaOrders)) errors.push(`accounts: duplicate demo persona order ${d}`)

  for (const c of world.clubs) {
    if (!airports.has(c.homeAirport)) errors.push(`club ${c.id}: unknown home airport ${c.homeAirport}`)
    if (offersSchoolPlans(c) === (c.plan === 'community')) {
      errors.push(`club ${c.id}: flight schools and flying clubs need a school plan; community clubs use "community"`)
    }
  }

  const activePairs: string[] = []
  const homeSchoolsByAccount = new Map<string, number>()
  for (const m of world.memberships) {
    const account = accounts.get(m.accountId)
    const club = clubs.get(m.clubId)
    if (!account) errors.push(`membership ${m.id}: unknown account ${m.accountId}`)
    if (!club) errors.push(`membership ${m.id}: unknown club ${m.clubId}`)
    if ((m.status === 'former') !== (m.endedOn !== null)) {
      errors.push(`membership ${m.id}: endedOn is required exactly when status is "former"`)
    }
    if (m.status === 'active') activePairs.push(`${m.accountId}→${m.clubId}`)
    if (m.status === 'active' && m.isHomeSchool) {
      homeSchoolsByAccount.set(m.accountId, (homeSchoolsByAccount.get(m.accountId) ?? 0) + 1)
      if (club && !offersSchoolPlans(club)) errors.push(`membership ${m.id}: home school must be a flight school or flying club`)
    }
    if (m.roles.includes('staff_cfi') && account && !isVerified(account)) {
      errors.push(`membership ${m.id}: staff_cfi requires a verified CFI account`)
    }
    if (m.roles.includes('admin') && club && !club.claimed) {
      errors.push(`membership ${m.id}: an unclaimed school page cannot have admins`)
    }
    if (m.sponsoredPilotPro && club && club.plan !== 'school_pro') {
      errors.push(`membership ${m.id}: only School Pro clubs can sponsor Pilot Pro seats`)
    }
  }
  const flightIds = new Set(world.flights.map((f) => f.id))
  for (const d of duplicates(world.flights.map((f) => f.id))) errors.push(`flights: duplicate id ${d}`)
  for (const f of world.flights) {
    if (!accounts.has(f.pilotId)) errors.push(`flight ${f.id}: unknown pilot ${f.pilotId}`)
    for (const code of [f.departure, f.arrival, ...f.landings.map((l) => l.icao)]) {
      if (code !== null && !airports.has(code)) errors.push(`flight ${f.id}: unknown airport ${code}`)
    }
    if (f.clubId !== null && !clubs.has(f.clubId)) errors.push(`flight ${f.id}: unknown club ${f.clubId}`)
    if ((f.simConfirmation !== null) !== (f.isSimulator && f.clubId !== null)) {
      errors.push(`flight ${f.id}: simConfirmation is required exactly for simulator sessions tagged to a club`)
    }
  }

  for (const d of duplicates(world.achievements.map((a) => a.id))) errors.push(`achievements: duplicate id ${d}`)
  for (const d of duplicates(world.achievements.map((a) => `${a.pilotId}/${a.code}`))) {
    errors.push(`achievements: ${d} awarded more than once`)
  }
  for (const a of world.achievements) {
    if (!accounts.has(a.pilotId)) errors.push(`achievement ${a.id}: unknown pilot ${a.pilotId}`)
    if (a.flightId !== null && !flightIds.has(a.flightId)) errors.push(`achievement ${a.id}: unknown flight ${a.flightId}`)
    if (a.icao !== null && !airports.has(a.icao)) errors.push(`achievement ${a.id}: unknown airport ${a.icao}`)
  }

  errors.push(...checkSocialIntegrity(world, accounts, flightIds, clubs))
  errors.push(...checkMissionIntegrity(world, accounts, airports, clubs))

  for (const d of duplicates(activePairs)) errors.push(`memberships: more than one active membership for ${d}`)
  for (const [accountId, n] of homeSchoolsByAccount) {
    if (n > 1) errors.push(`account ${accountId}: more than one active home school`)
  }

  return errors
}

function checkSocialIntegrity(
  world: World,
  accounts: ReadonlyMap<string, Account>,
  flightIds: ReadonlySet<string>,
  clubs: ReadonlyMap<string, unknown>,
): string[] {
  const errors: string[] = []
  const known = (kind: string, accountId: string) => {
    if (!accounts.has(accountId)) errors.push(`${kind}: unknown account ${accountId}`)
  }
  const knownFlight = (kind: string, flightId: string) => {
    if (!flightIds.has(flightId)) errors.push(`${kind}: unknown flight ${flightId}`)
  }

  for (const a of world.accounts) {
    if (a.isMinor && a.profileLevel !== 'private') errors.push(`account ${a.id}: minor accounts must be Private`)
  }

  for (const f of world.flights) {
    const tags = [...(f.instructor ? [f.instructor] : []), ...f.flewWith]
    for (const t of tags) {
      known(`flight ${f.id} tag`, t.accountId)
      if (t.accountId === f.pilotId) errors.push(`flight ${f.id}: a pilot can't tag themselves`)
    }
    for (const d of duplicates(tags.map((t) => t.accountId))) errors.push(`flight ${f.id}: ${d} tagged more than once`)
    if (f.instructor) {
      const cfi = accounts.get(f.instructor.accountId)
      if (cfi && !isVerified(cfi)) errors.push(`flight ${f.id}: instructor ${cfi.id} is not a verified CFI`)
    }
  }

  for (const d of duplicates(world.follows.map((x) => `${x.followerId}→${x.followeeId}`))) errors.push(`follows: duplicate ${d}`)
  for (const x of world.follows) {
    known('follow', x.followerId)
    known('follow', x.followeeId)
    if (x.followerId === x.followeeId) errors.push(`follow ${x.followerId}: can't follow yourself`)
  }

  for (const d of duplicates(world.props.map((p) => `${p.accountId}/${p.flightId}`))) errors.push(`props: duplicate ${d}`)
  for (const p of world.props) {
    known('props', p.accountId)
    knownFlight('props', p.flightId)
  }

  for (const d of duplicates([...world.comments, ...world.debriefs].map((c) => c.id))) errors.push(`comments/debriefs: duplicate id ${d}`)
  for (const c of world.comments) {
    known(`comment ${c.id}`, c.authorId)
    knownFlight(`comment ${c.id}`, c.flightId)
  }
  for (const m of world.debriefs) {
    known(`debrief ${m.id}`, m.authorId)
    const f = world.flights.find((x) => x.id === m.flightId)
    if (!f) errors.push(`debrief ${m.id}: unknown flight ${m.flightId}`)
    else if (m.authorId !== f.pilotId && !(f.instructor?.accountId === m.authorId && f.instructor.status === 'accepted')) {
      errors.push(`debrief ${m.id}: only the pilot and the accepted instructor can write in a debrief`)
    }
  }

  for (const d of duplicates(world.cfiLinks.map((l) => l.id))) errors.push(`cfiLinks: duplicate id ${d}`)
  for (const d of duplicates(world.cfiLinks.filter((l) => l.status === 'active').map((l) => `${l.cfiId}→${l.studentId}`))) {
    errors.push(`cfiLinks: more than one active link ${d}`)
  }
  for (const l of world.cfiLinks) {
    known(`cfiLink ${l.id}`, l.studentId)
    const cfi = accounts.get(l.cfiId)
    if (!cfi) errors.push(`cfiLink ${l.id}: unknown account ${l.cfiId}`)
    else if (!isVerified(cfi)) errors.push(`cfiLink ${l.id}: ${l.cfiId} is not a verified CFI`)
    if (l.cfiId === l.studentId) errors.push(`cfiLink ${l.id}: a CFI can't be their own student`)
  }

  for (const d of duplicates(world.signoffs.map((s) => s.id))) errors.push(`signoffs: duplicate id ${d}`)
  const activeSubjects: string[] = []
  for (const s of world.signoffs) {
    known(`signoff ${s.id}`, s.studentId)
    const cfi = accounts.get(s.cfiId)
    if (!cfi) errors.push(`signoff ${s.id}: unknown account ${s.cfiId}`)
    else if (!isVerified(cfi)) errors.push(`signoff ${s.id}: ${s.cfiId} is not a verified CFI`)
    if (s.cfiId === s.studentId) errors.push(`signoff ${s.id}: no self-verification`)
    if ((s.flightId === null) === (s.milestone === null)) errors.push(`signoff ${s.id}: set exactly one of flightId and milestone`)
    if (s.clubId !== null && !clubs.has(s.clubId)) errors.push(`signoff ${s.id}: unknown club ${s.clubId}`)
    if (s.flightId !== null) {
      const f = world.flights.find((x) => x.id === s.flightId)
      if (!f) errors.push(`signoff ${s.id}: unknown flight ${s.flightId}`)
      else if (f.pilotId !== s.studentId || f.instructor?.accountId !== s.cfiId || f.instructor.status !== 'accepted') {
        errors.push(`signoff ${s.id}: a flight sign-off needs the flight's accepted instructor and its pilot`)
      }
    }
    if (s.schoolAircraft && (s.milestone === null || s.clubId === null)) {
      errors.push(`signoff ${s.id}: schoolAircraft applies only to a milestone signed for a school`)
    }
    if (s.revoked === null) activeSubjects.push(`${s.studentId}/${s.flightId ?? s.milestone}`)
  }
  for (const d of duplicates(activeSubjects)) errors.push(`signoffs: more than one active sign-off for ${d}`)

  for (const d of duplicates(world.signoffRequests.map((r) => r.id))) errors.push(`signoffRequests: duplicate id ${d}`)
  for (const r of world.signoffRequests) {
    known(`signoffRequest ${r.id}`, r.studentId)
    known(`signoffRequest ${r.id}`, r.cfiId)
  }

  for (const b of world.blocks) {
    known('block', b.blockerId)
    known('block', b.blockedId)
    if (b.blockerId === b.blockedId) errors.push(`block ${b.blockerId}: can't block yourself`)
  }
  for (const d of duplicates(world.reports.map((r) => r.id))) errors.push(`reports: duplicate id ${d}`)

  return errors
}

function checkMissionIntegrity(
  world: World,
  accounts: ReadonlyMap<string, Account>,
  airports: ReadonlySet<string>,
  clubs: ReadonlyMap<string, unknown>,
): string[] {
  const errors: string[] = []
  const missions = new Map(world.missions.map((m) => [m.code, m]))
  for (const d of duplicates(world.missions.map((m) => m.code))) errors.push(`missions: duplicate code ${d}`)
  for (const m of world.missions) {
    const r = m.requirements
    for (const code of r.landAtAny ?? []) if (!airports.has(code)) errors.push(`mission ${m.code}: unknown airport ${code}`)
    const checks = [r.landAtAny, r.minDistanceFromDepartureNm, r.minTotalNm, r.minFullStopAirports, r.minFieldElevationFt]
    const hasCheck = checks.some((c) => c !== undefined)
    if (hasCheck === r.cfiOnly) errors.push(`mission ${m.code}: needs track checks, or cfiOnly with none`)
  }
  for (const d of duplicates(world.pathways.map((p) => p.code))) errors.push(`pathways: duplicate code ${d}`)
  for (const p of world.pathways) {
    for (const code of p.missionCodes) if (!missions.has(code)) errors.push(`pathway ${p.code}: unknown mission ${code}`)
  }
  const challenges = new Set(world.challenges.map((c) => c.code))
  for (const d of duplicates(world.challenges.map((c) => c.code))) errors.push(`challenges: duplicate code ${d}`)
  for (const c of world.challenges) {
    if (c.clubId !== null && !clubs.has(c.clubId)) errors.push(`challenge ${c.code}: unknown club ${c.clubId}`)
    if ((c.kind === 'states') !== (c.states.length > 0)) errors.push(`challenge ${c.code}: states are required exactly for a states challenge`)
    if ((c.kind === 'states') !== (c.target === null)) errors.push(`challenge ${c.code}: target is required except for a states challenge`)
  }
  for (const d of duplicates(world.challengeEntries.map((e) => `${e.pilotId}/${e.challengeCode}`))) errors.push(`challengeEntries: duplicate ${d}`)
  for (const e of world.challengeEntries) {
    if (!accounts.has(e.pilotId)) errors.push(`challengeEntry: unknown account ${e.pilotId}`)
    if (!challenges.has(e.challengeCode)) errors.push(`challengeEntry: unknown challenge ${e.challengeCode}`)
  }
  for (const d of duplicates(world.noGos.map((n) => n.id))) errors.push(`noGos: duplicate id ${d}`)
  for (const n of world.noGos) {
    if (!accounts.has(n.pilotId)) errors.push(`noGo ${n.id}: unknown account ${n.pilotId}`)
    for (const code of [n.from, n.to]) if (code !== null && !airports.has(code)) errors.push(`noGo ${n.id}: unknown airport ${code}`)
  }
  for (const d of duplicates(world.nudges.map((n) => n.id))) errors.push(`nudges: duplicate id ${d}`)
  for (const n of world.nudges) {
    if (!clubs.has(n.clubId)) errors.push(`nudge ${n.id}: unknown club ${n.clubId}`)
    for (const who of [n.fromAccountId, n.toAccountId]) if (!accounts.has(who)) errors.push(`nudge ${n.id}: unknown account ${who}`)
    if (n.missionCode !== null && !missions.has(n.missionCode)) errors.push(`nudge ${n.id}: unknown mission ${n.missionCode}`)
  }
  for (const d of duplicates(world.missionAssignments.map((a) => a.id))) errors.push(`missionAssignments: duplicate id ${d}`)
  for (const a of world.missionAssignments) {
    if (!missions.has(a.missionCode)) errors.push(`missionAssignment ${a.id}: unknown mission ${a.missionCode}`)
    for (const who of [a.cfiId, a.studentId]) if (!accounts.has(who)) errors.push(`missionAssignment ${a.id}: unknown account ${who}`)
  }
  for (const d of duplicates(world.repostRequests.map((r) => r.id))) errors.push(`repostRequests: duplicate id ${d}`)
  for (const r of world.repostRequests) {
    const v = world.missionVerifications.find((x) => x.id === r.verificationId)
    if (!v) errors.push(`repostRequest ${r.id}: unknown verification ${r.verificationId}`)
    else if (v.pilotId !== r.pilotId || v.clubId !== r.clubId) errors.push(`repostRequest ${r.id}: doesn't match its verification`)
    if (accounts.get(r.pilotId)?.isMinor && r.status !== 'withdrawn') errors.push(`repostRequest ${r.id}: minors are never asked to repost`)
  }
  for (const d of duplicates(world.missionVerifications.map((v) => v.id))) errors.push(`missionVerifications: duplicate id ${d}`)
  const active: string[] = []
  for (const v of world.missionVerifications) {
    if (!missions.has(v.missionCode)) errors.push(`missionVerification ${v.id}: unknown mission ${v.missionCode}`)
    if (!accounts.has(v.byAccountId)) errors.push(`missionVerification ${v.id}: unknown account ${v.byAccountId}`)
    if (v.byAccountId === v.pilotId) errors.push(`missionVerification ${v.id}: a pilot can't verify their own mission`)
    if (v.clubId !== null && !clubs.has(v.clubId)) errors.push(`missionVerification ${v.id}: unknown club ${v.clubId}`)
    if (v.flightId === null) {
      if (v.clubId === null) errors.push(`missionVerification ${v.id}: a verification without a flight must be recorded for a school`)
    } else {
      const f = world.flights.find((x) => x.id === v.flightId)
      if (!f) errors.push(`missionVerification ${v.id}: unknown flight ${v.flightId}`)
      else {
        if (f.pilotId !== v.pilotId) errors.push(`missionVerification ${v.id}: flight belongs to another pilot`)
        if (v.clubId !== null && f.clubId !== v.clubId) errors.push(`missionVerification ${v.id}: flight isn't tagged to ${v.clubId}`)
        if (v.schoolAircraft !== (v.clubId !== null)) errors.push(`missionVerification ${v.id}: on a tracked flight, schoolAircraft follows the school tag`)
      }
    }
    if (v.revoked === null) active.push(`${v.pilotId}/${v.missionCode}`)
  }
  for (const d of duplicates(active)) errors.push(`missionVerifications: more than one active verification for ${d}`)
  for (const d of duplicates(world.missionClaims.map((c) => `${c.pilotId}/${c.missionCode}`))) errors.push(`missionClaims: duplicate ${d}`)
  for (const c of world.missionClaims) {
    if (!accounts.has(c.pilotId)) errors.push(`missionClaim: unknown account ${c.pilotId}`)
    if (!missions.has(c.missionCode)) errors.push(`missionClaim: unknown mission ${c.missionCode}`)
  }
  return errors
}

function isVerified(account: Account): boolean {
  return account.cfi?.verified === true
}

export function demoPersonas(world: World): Account[] {
  return world.accounts
    .filter((a) => a.demoPersona !== null)
    .sort((a, b) => (a.demoPersona?.order ?? 0) - (b.demoPersona?.order ?? 0))
}

export function homeSchoolOf(world: World, accountId: string) {
  const m = world.memberships.find((x) => x.accountId === accountId && x.status === 'active' && x.isHomeSchool)
  return m ? (world.clubs.find((c) => c.id === m.clubId) ?? null) : null
}

export function activeMemberCount(world: World, clubId: string): number {
  return new Set(
    world.memberships.filter((m) => m.clubId === clubId && m.status === 'active').map((m) => m.accountId),
  ).size
}

/** Clubs the account administers (claimed schools only). */
export function adminClubsOf(world: World, accountId: string) {
  const ids = new Set(
    world.memberships
      .filter((m) => m.accountId === accountId && m.status === 'active' && m.roles.includes('admin'))
      .map((m) => m.clubId),
  )
  return world.clubs.filter((c) => ids.has(c.id) && c.claimed)
}

