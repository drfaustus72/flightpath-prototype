import { airportEvents, flightsInOrder } from './recognition'
import type { Challenge, ChallengeEntry, World } from './types'

/**
 * Opt-in challenges (CLAUDE.md rule 4): experience and good decisions, never speed, altitude or
 * risk. No leaderboards and no deadlines; progress counts from the day the pilot joins.
 */

export interface ChallengeProgress {
  current: number
  target: number
  done: boolean
  /** What's counted so far, e.g. airport idents or states. */
  items: string[]
}

export function entryFor(world: World, pilotId: string, code: string): ChallengeEntry | undefined {
  return world.challengeEntries.find((e) => e.pilotId === pilotId && e.challengeCode === code)
}

export function challengeProgress(world: World, pilotId: string, challenge: Challenge, joinedAt: string): ChallengeProgress {
  const flights = flightsInOrder(world.flights.filter((f) => f.pilotId === pilotId && !f.isSimulator))
  const when = (f: { startedAt: string | null; createdAt: string }) => f.startedAt ?? f.createdAt

  switch (challenge.kind) {
    case 'new_airports': {
      // Airports first visited after joining.
      const before = new Set<string>()
      const after: string[] = []
      for (const f of flights) {
        const visited = [...airportEvents(f).keys()]
        for (const icao of visited) {
          if (before.has(icao) || after.includes(icao)) continue
          if (when(f) < joinedAt) before.add(icao)
          else after.push(icao)
        }
      }
      const target = challenge.target ?? 1
      return { current: Math.min(after.length, target), target, done: after.length >= target, items: after }
    }
    case 'states': {
      const airports = new Map(world.airports.map((a) => [a.icao, a]))
      const landed = new Set(
        flights
          .filter((f) => when(f) >= joinedAt)
          .flatMap((f) => f.landings.flatMap((l) => (l.icao ? [airports.get(l.icao)?.state ?? ''] : []))),
      )
      const items = challenge.states.filter((s) => landed.has(s))
      return { current: items.length, target: challenge.states.length, done: items.length === challenge.states.length, items }
    }
    case 'no_go': {
      const items = world.noGos.filter((n) => n.pilotId === pilotId && n.at >= joinedAt).map((n) => n.id)
      const target = challenge.target ?? 1
      return { current: Math.min(items.length, target), target, done: items.length >= target, items }
    }
  }
}
