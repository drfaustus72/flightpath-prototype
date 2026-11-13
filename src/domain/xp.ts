import { milestoneTitle } from './milestones'
import type { Club, MilestoneCode, World } from './types'

/**
 * XP (CLAUDE.md rules 2 and 7): school-bound, held per School Pro school, never transferred.
 * It comes only from things the school verified:
 *  - missions verified for that school, on flights tagged to it (flown in its aircraft);
 *  - milestones a staff CFI signed off for that school, flown in its aircraft.
 * A logged flight earns nothing by itself. No-gos earn a badge, never XP. Ranks are recognition;
 * any discount is out of scope until aviation counsel reviews it (rule 8).
 */

/** Placeholder values; tune after school interviews. */
export const MILESTONE_XP: Record<MilestoneCode, number> = {
  first_solo: 300,
  first_solo_xc: 300,
  private_checkride: 500,
  instrument_rating: 500,
  flight_review: 150,
  ipc: 150,
  tailwheel: 200,
  high_performance: 200,
}

export const RANKS = [
  { name: 'Explorer', minXp: 0 },
  { name: 'Navigator', minXp: 500 },
  { name: 'Pathfinder', minXp: 1500 },
  { name: 'Trailblazer', minXp: 3000 },
] as const

export type RankName = (typeof RANKS)[number]['name']

export interface XpEntry {
  kind: 'mission' | 'milestone'
  title: string
  xp: number
  at: string
}

export interface SchoolXp {
  club: Club
  xp: number
  rank: RankName
  nextRank: { name: RankName; xpToGo: number } | null
  entries: XpEntry[]
}

/** School Pro schools (claimed) where the pilot is an active member: the only places XP is held. */
export function xpClubsOf(world: World, pilotId: string): Club[] {
  const ids = new Set(world.memberships.filter((m) => m.accountId === pilotId && m.status === 'active').map((m) => m.clubId))
  return world.clubs.filter((c) => ids.has(c.id) && c.plan === 'school_pro' && c.claimed)
}

export function rankFor(xp: number): { rank: RankName; nextRank: SchoolXp['nextRank'] } {
  let index = 0
  RANKS.forEach((r, i) => {
    if (xp >= r.minXp) index = i
  })
  const current = RANKS[index] ?? RANKS[0]
  const next = RANKS[index + 1]
  return { rank: current.name, nextRank: next ? { name: next.name, xpToGo: next.minXp - xp } : null }
}

export function xpEntries(world: World, pilotId: string, clubId: string): XpEntry[] {
  const missions: XpEntry[] = world.missionVerifications.flatMap((v) => {
    if (v.pilotId !== pilotId || v.clubId !== clubId || v.revoked !== null) return []
    const mission = world.missions.find((m) => m.code === v.missionCode)
    const flight = world.flights.find((f) => f.id === v.flightId)
    if (!mission || flight?.clubId !== clubId) return []
    return [{ kind: 'mission' as const, title: mission.title, xp: mission.xp, at: v.at }]
  })
  const milestones: XpEntry[] = world.signoffs.flatMap((s) => {
    if (s.studentId !== pilotId || s.clubId !== clubId || s.revoked !== null || !s.schoolAircraft || s.milestone === null) return []
    return [{ kind: 'milestone' as const, title: milestoneTitle(s.milestone), xp: MILESTONE_XP[s.milestone], at: s.at }]
  })
  return [...missions, ...milestones].sort((a, b) => b.at.localeCompare(a.at))
}

export function xpSummary(world: World, pilotId: string): SchoolXp[] {
  return xpClubsOf(world, pilotId).map((club) => {
    const entries = xpEntries(world, pilotId, club.id)
    const xp = entries.reduce((sum, e) => sum + e.xp, 0)
    return { club, xp, entries, ...rankFor(xp) }
  })
}
