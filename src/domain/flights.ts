import { distanceNm } from './geo'
import type { Flight } from './types'

/** Route privacy: "hide_ends" trims this much from each end so home fields and hangars stay private. */
export const HIDDEN_END_NM = 1

/**
 * The route a given viewer may see. The pilot always sees the full route.
 * Returns null when the route is hidden from this viewer.
 */
export function routeForViewer(flight: Flight, viewerId: string): [number, number][] | null {
  if (viewerId === flight.pilotId || flight.routeVisibility === 'full') return flight.route
  if (flight.routeVisibility === 'hidden') return null
  const trimmed = trimEnds(flight.route, HIDDEN_END_NM)
  return trimmed.length >= 2 ? trimmed : null
}

function trimEnds(route: readonly [number, number][], nm: number): [number, number][] {
  const start = route[0]
  const end = route.at(-1)
  if (!start || !end) return []
  const far = (p: [number, number], from: [number, number]) => distanceNm(p[1], p[0], from[1], from[0]) > nm
  const first = route.findIndex((p) => far(p, start))
  let last = -1
  for (let i = route.length - 1; i >= 0; i--) {
    const p = route[i]
    if (p && far(p, end)) {
      last = i
      break
    }
  }
  if (first === -1 || last === -1 || last < first) return []
  return route.slice(first, last + 1)
}

export function formatDuration(sec: number | null): string {
  if (sec === null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export type PostChoices = Pick<Flight, 'caption' | 'routeVisibility' | 'clubId' | 'postVisibility'> & {
  /** CFI tagged as instructor; the tag shows once the CFI accepts it. */
  instructorId: string | null
  /** People tagged as co-pilot, safety pilot or passenger; each tag shows once accepted. */
  flewWithIds: string[]
}

type DraftFields = Omit<
  Flight,
  'id' | 'pilotId' | 'createdAt' | 'simConfirmation' | 'instructor' | 'flewWith' | 'caption' | 'routeVisibility' | 'clubId' | 'postVisibility'
>

/** Turns an imported draft plus the pilot's sharing choices into a stored flight. */
export function createFlight(
  draft: { airportsVisited: string[] } & DraftFields,
  choices: PostChoices,
  pilotId: string,
  id: string,
  createdAt: string,
): Flight {
  const { airportsVisited: _visited, ...rest } = draft
  const { instructorId, flewWithIds, ...post } = choices
  const simConfirmation =
    draft.isSimulator && choices.clubId !== null ? { status: 'pending' as const, byAccountId: null, at: null } : null
  return {
    ...rest,
    ...post,
    caption: post.caption.trim(),
    simConfirmation,
    instructor: instructorId === null ? null : { accountId: instructorId, status: 'pending' },
    flewWith: [...new Set(flewWithIds)].filter((x) => x !== instructorId).map((accountId) => ({ accountId, status: 'pending' as const })),
    id,
    pilotId,
    createdAt,
  }
}
