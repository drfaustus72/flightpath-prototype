import { missionStatus, missionStatuses } from './missions'
import { ASSIGNMENT_NOTE_MAX } from './schemas'
import { linkedStudentsOf, milestonesFor } from './signoffs'
import type { OpContext } from './socialOps'
import { accessContextFor, can } from './tiers'
import type { Account, MissionAssignment, World } from './types'

/**
 * CFI Pro tools for an instructor's own students (linked through cfiLinks): a roster with
 * each student's progress, and mission suggestions the student's advisor shows first.
 */

function requireCfiPro(world: World, cfiId: string, feature: 'cfi.roster' | 'cfi.assignMissions') {
  const ctx = accessContextFor(world, cfiId)
  if (!ctx || !can(ctx, feature)) throw new Error('That’s part of CFI Pro')
}

function isLinked(world: World, cfiId: string, studentId: string): boolean {
  return world.cfiLinks.some((l) => l.cfiId === cfiId && l.studentId === studentId && l.status === 'active')
}

function isComplete(world: World, studentId: string, missionCode: string): boolean {
  const mission = world.missions.find((m) => m.code === missionCode)
  return mission !== undefined && missionStatus(world, studentId, mission).complete
}

/** Suggestions still standing: not withdrawn, not yet flown, and from a CFI still linked to the student. Newest first. */
export function openAssignmentsFor(world: World, studentId: string): MissionAssignment[] {
  return world.missionAssignments
    .filter((a) => a.studentId === studentId && a.withdrawnAt === null && isLinked(world, a.cfiId, studentId) && !isComplete(world, studentId, a.missionCode))
    .sort((a, b) => b.at.localeCompare(a.at))
}

export function assignMission(world: World, cfiId: string, args: { studentId: string; missionCode: string; note: string }, ctx: OpContext): World {
  requireCfiPro(world, cfiId, 'cfi.assignMissions')
  if (!isLinked(world, cfiId, args.studentId)) throw new Error('You can suggest missions to your own students')
  if (!world.missions.some((m) => m.code === args.missionCode)) throw new Error('Unknown mission')
  if (isComplete(world, args.studentId, args.missionCode)) throw new Error('They’ve already flown this one')
  if (openAssignmentsFor(world, args.studentId).some((a) => a.cfiId === cfiId && a.missionCode === args.missionCode)) {
    throw new Error('You’ve already suggested this mission')
  }
  const note = args.note.trim()
  if (note.length > ASSIGNMENT_NOTE_MAX) throw new Error(`Keep the note under ${ASSIGNMENT_NOTE_MAX} characters`)
  const assignment: MissionAssignment = { id: ctx.id, cfiId, studentId: args.studentId, missionCode: args.missionCode, note, at: ctx.now, withdrawnAt: null }
  return { ...world, missionAssignments: [...world.missionAssignments, assignment] }
}

export function withdrawAssignment(world: World, cfiId: string, assignmentId: string, ctx: OpContext): World {
  const a = world.missionAssignments.find((x) => x.id === assignmentId)
  if (!a || a.cfiId !== cfiId) throw new Error('Suggestion not found')
  if (a.withdrawnAt !== null) return world
  return { ...world, missionAssignments: world.missionAssignments.map((x) => (x === a ? { ...x, withdrawnAt: ctx.now } : x)) }
}

export interface RosterRow {
  student: Account
  lastFlightAt: string | null
  /** Completed steps on the first pathway, and how many there are. */
  pathway: { done: number; total: number } | null
  milestonesSigned: number
  openRequests: number
  suggestions: MissionAssignment[]
}

/** The instructor's students, longest since they last flew first. */
export function rosterFor(world: World, cfiId: string): RosterRow[] {
  requireCfiPro(world, cfiId, 'cfi.roster')
  const pathway = world.pathways[0]
  const rows = linkedStudentsOf(world, cfiId).map((student) => {
    const lastFlightAt = world.flights
      .filter((f) => f.pilotId === student.id && !f.isSimulator && f.startedAt !== null)
      .reduce<string | null>((max, f) => (f.startedAt !== null && (max === null || f.startedAt > max) ? f.startedAt : max), null)
    const complete = new Set(missionStatuses(world, student.id).filter((s) => s.complete).map((s) => s.mission.code))
    return {
      student,
      lastFlightAt,
      pathway: pathway ? { done: pathway.missionCodes.filter((c) => complete.has(c)).length, total: pathway.missionCodes.length } : null,
      milestonesSigned: milestonesFor(world, student.id).filter((m) => m.signoff).length,
      openRequests: world.signoffRequests.filter((r) => r.studentId === student.id && r.cfiId === cfiId && r.status === 'open').length,
      suggestions: openAssignmentsFor(world, student.id).filter((a) => a.cfiId === cfiId),
    }
  })
  return rows.sort((a, b) => (a.lastFlightAt ?? '').localeCompare(b.lastFlightAt ?? '') || a.student.displayName.localeCompare(b.student.displayName))
}
