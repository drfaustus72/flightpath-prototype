import { distanceNm } from './geo'
import { milestonesFor, linkedCfisOf } from './signoffs'
import { type MissionStatus, missionStatuses } from './missions'
import type { Mission, Pathway, World } from './types'

/**
 * The rule-based advisor (CLAUDE.md rule 6): it suggests what to try next and why, and always
 * hands the decision to the CFI. It never says a pilot is ready for anything.
 */

export interface PathwayStep {
  mission: Mission
  complete: boolean
  verified: boolean
}

export function pathwaySteps(world: World, pilotId: string, pathway: Pathway): PathwayStep[] {
  const statuses = new Map(missionStatuses(world, pilotId).map((s) => [s.mission.code, s]))
  return pathway.missionCodes.flatMap((code) => {
    const s = statuses.get(code)
    return s ? [{ mission: s.mission, complete: s.complete, verified: s.verification !== null }] : []
  })
}

export interface Advice {
  mission: Mission
  /** e.g. "Next on Private Pilot Cross-Country: step 1 of 5". */
  context: string
  reasons: string[]
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

export function adviceFor(world: World, pilotId: string): Advice | null {
  const pilot = world.accounts.find((a) => a.id === pilotId)
  if (!pilot) return null
  const cfi = linkedCfisOf(world, pilotId)[0]
  const handoff = cfi
    ? `Talk it over with ${cfi.displayName.split(' ')[0]} before you go. Your CFI decides when you’re ready.`
    : 'Talk it over with a CFI before you go. Your CFI decides when you’re ready.'

  const reasons = (m: Mission, extra: string[]) => {
    const nm = distanceFromHome(world, pilotId, m)
    const list = [...extra]
    if (nm !== null && nm > 0) list.push(`About ${nm} nm from ${pilot.homeAirport}.`)
    if (m.prerequisites.length > 0) list.push(`Before you go: ${m.prerequisites.join('; ').toLowerCase()}.`)
    return list
  }

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
        reasons: reasons(step.mission, done > 0 ? [`You've completed ${done} of ${steps.length} steps.`] : []),
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
  return { mission: nearest.s.mission, context: 'A mission to try next', reasons: reasons(nearest.s.mission, []), handoff }
}
