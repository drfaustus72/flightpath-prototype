import { distanceNm } from './geo'
import { milestonesFor, linkedCfisOf } from './signoffs'
import { type MissionStatus, missionStatuses } from './missions'
import { openAssignmentsFor } from './roster'
import type { Mission, Pathway, World } from './types'

/**
 * The rule-based advisor (CLAUDE.md rule 6): it suggests what to try next and why, and always
 * hands the decision to the CFI. It never says a pilot is ready for anything.
 */

export interface PathwayStep {
  mission: Mission
  complete: boolean
  source: MissionStatus['source']
}

export function pathwaySteps(world: World, pilotId: string, pathway: Pathway): PathwayStep[] {
  const statuses = new Map(missionStatuses(world, pilotId).map((s) => [s.mission.code, s]))
  return pathway.missionCodes.flatMap((code) => {
    const s = statuses.get(code)
    return s ? [{ mission: s.mission, complete: s.complete, source: s.source }] : []
  })
}

export interface Advice {
  mission: Mission
  /** e.g. "Next on Private Pilot Cross-Country: step 1 of 5". */
  context: string
  reasons: string[]
  /** The mission's prerequisites, to talk through with the CFI. */
  beforeYouGo: string[]
  /** Always present: who makes the call. */
  handoff: string
}

function hasMilestones(world: World, pilotId: string, mission: Mission): boolean {
  const reached = new Set(milestonesFor(world, pilotId).filter((m) => m.claim || m.signoff).map((m) => m.code))
  return mission.suggestAfter.every((c) => reached.has(c))
}

function distanceFromHome(world: World, pilotId: string, mission: Mission): number | null {
  const home = world.accounts.find((a) => a.id === pilotId)?.homeAirport
  const from = world.airports.find((a) => a.icao === home)
  const to = world.airports.find((a) => a.icao === mission.requirements.landAtAny?.[0])
  return from && to ? Math.round(distanceNm(from.lat, from.lon, to.lat, to.lon)) : null
}

function handoffFor(world: World, pilotId: string): string {
  const cfi = linkedCfisOf(world, pilotId)[0]
  return cfi
    ? `Talk it over with ${cfi.displayName.split(' ')[0]} before you go. Your CFI decides when you’re ready.`
    : 'Talk it over with a CFI before you go. Your CFI decides when you’re ready.'
}

function reasonsFor(world: World, pilotId: string, m: Mission, extra: string[]): string[] {
  const home = world.accounts.find((a) => a.id === pilotId)?.homeAirport
  const nm = distanceFromHome(world, pilotId, m)
  const list = [...extra]
  if (nm !== null && nm > 0 && home) list.push(`About ${nm} nm from ${home}.`)
  return list
}

/**
 * The newest mission the pilot's own CFI suggested and they haven't flown yet. Shown to every
 * pilot with a CFI Pro instructor, even without the full advisor.
 */
export function suggestionAdvice(world: World, pilotId: string): Advice | null {
  const assigned = openAssignmentsFor(world, pilotId)[0]
  const mission = assigned && world.missions.find((m) => m.code === assigned.missionCode)
  const by = assigned && world.accounts.find((a) => a.id === assigned.cfiId)
  if (!assigned || !mission || !by) return null
  return {
    mission,
    context: `${by.displayName.split(' ')[0]} suggests`,
    reasons: reasonsFor(world, pilotId, mission, assigned.note ? [`“${assigned.note}”`] : []),
    beforeYouGo: mission.prerequisites,
    handoff: handoffFor(world, pilotId),
  }
}

export function adviceFor(world: World, pilotId: string): Advice | null {
  const pilot = world.accounts.find((a) => a.id === pilotId)
  if (!pilot) return null
  const handoff = handoffFor(world, pilotId)
  const reasons = (m: Mission, extra: string[]) => reasonsFor(world, pilotId, m, extra)

  // A mission the pilot's own CFI suggested comes first.
  const suggested = suggestionAdvice(world, pilotId)
  if (suggested) return suggested

  const pathway = world.pathways[0]
  if (pathway) {
    const steps = pathwaySteps(world, pilotId, pathway)
    const index = steps.findIndex((s) => !s.complete && hasMilestones(world, pilotId, s.mission))
    const step = steps[index]
    if (step) {
      const done = steps.filter((s) => s.complete).length
      return {
        mission: step.mission,
        context: `Next on ${pathway.title}: step ${index + 1} of ${steps.length}`,
        reasons: reasons(step.mission, done > 0 ? [`You’ve completed ${done} of ${steps.length} steps.`] : []),
        beforeYouGo: step.mission.prerequisites,
        handoff,
      }
    }
  }

  // Off the pathway: the nearest mission not yet flown whose milestones the pilot has.
  const open: MissionStatus[] = missionStatuses(world, pilotId).filter(
    (s) => !s.complete && !s.mission.requirements.cfiOnly && hasMilestones(world, pilotId, s.mission),
  )
  const nearest = open
    .map((s) => ({ s, nm: distanceFromHome(world, pilotId, s.mission) ?? Infinity }))
    .sort((a, b) => a.nm - b.nm)[0]
  if (!nearest) return null
  return {
    mission: nearest.s.mission,
    context: 'A mission to try next',
    reasons: reasons(nearest.s.mission, []),
    beforeYouGo: nearest.s.mission.prerequisites,
    handoff,
  }
}
