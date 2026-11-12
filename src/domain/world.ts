import { worldSchema } from './schemas'
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
    const isSchool = c.kind === 'flight_school'
    if (isSchool === (c.plan === 'community')) {
      errors.push(`club ${c.id}: flight schools need a school plan; other clubs use "community"`)
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
      if (club && club.kind !== 'flight_school') errors.push(`membership ${m.id}: home school must be a flight school`)
    }
    if (m.roles.includes('staff_cfi') && account && !isVerified(account)) {
      errors.push(`membership ${m.id}: staff_cfi requires a verified CFI account`)
    }
    if (m.roles.includes('admin') && club && !club.claimed) {
      errors.push(`membership ${m.id}: an unclaimed school page cannot have admins`)
    }
    if (m.sponsoredPilotPro && club && club.kind !== 'flight_school') {
      errors.push(`membership ${m.id}: only flight schools can sponsor Pilot Pro seats`)
    }
  }
  for (const d of duplicates(activePairs)) errors.push(`memberships: more than one active membership for ${d}`)
  for (const [accountId, n] of homeSchoolsByAccount) {
    if (n > 1) errors.push(`account ${accountId}: more than one active home school`)
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
