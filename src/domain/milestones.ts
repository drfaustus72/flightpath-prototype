import type { MilestoneCode } from './types'

/** Training milestones in the order a pilot usually reaches them. */
export const MILESTONES: readonly { code: MilestoneCode; title: string }[] = [
  { code: 'first_solo', title: 'First solo' },
  { code: 'first_solo_xc', title: 'First solo cross-country' },
  { code: 'private_checkride', title: 'Private Pilot checkride' },
  { code: 'instrument_rating', title: 'Instrument rating' },
  { code: 'flight_review', title: 'Flight review' },
  { code: 'ipc', title: 'Instrument proficiency check' },
  { code: 'tailwheel', title: 'Tailwheel endorsement' },
  { code: 'high_performance', title: 'High-performance endorsement' },
]

export function milestoneTitle(code: MilestoneCode): string {
  return MILESTONES.find((m) => m.code === code)?.title ?? code
}

/** Achievement code used when a pilot records a milestone themselves. */
export const milestoneAchievementCode = (code: MilestoneCode) => `milestone:${code}`

/** Shown wherever a sign-off appears (CLAUDE.md rule 3). */
export const SIGNOFF_DISCLAIMER = 'A Flightpath platform verification, not an FAA endorsement or logbook entry.'

/** Short form for compact badges (feed cards, trophy case). */
export const SIGNOFF_DISCLAIMER_SHORT = 'Platform verification, not an FAA endorsement.'
