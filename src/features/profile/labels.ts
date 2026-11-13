import { isVerifiedCfi } from '../../domain/tiers'
import type { Account } from '../../domain/types'

export const certificateNames: Record<string, string> = {
  student: 'Student',
  sport: 'Sport',
  recreational: 'Recreational',
  private: 'Private',
  instrument: 'Instrument',
  commercial: 'Commercial',
  multi_engine: 'Multi-engine',
  atp: 'ATP',
}

/** Badges shown on someone else's profile. Plan names stay private; only the CFI role shows. */
export function publicBadges(owner: Account): string[] {
  return isVerifiedCfi(owner) ? [`Verified ${owner.cfi?.ratings.join(', ') ?? 'CFI'}`] : []
}
