import { loadWorld } from '../../domain/world'
import accounts from './accounts.json'
import airports from './airports.json'
import achievements from './achievements.json'
import clubs from './clubs.json'
import flights from './flights.json'
import memberships from './memberships.json'
import follows from './follows.json'
import props from './props.json'
import comments from './comments.json'
import debriefs from './debriefs.json'
import cfiLinks from './cfiLinks.json'
import signoffs from './signoffs.json'
import signoffRequests from './signoffRequests.json'
import blocks from './blocks.json'
import reports from './reports.json'

export const rawSeed = {
  accounts,
  clubs,
  memberships,
  airports,
  flights,
  achievements,
  follows,
  props,
  comments,
  debriefs,
  cfiLinks,
  signoffs,
  signoffRequests,
  blocks,
  reports,
}

/** Validated once at startup. The app renders an error screen if this fails. */
export const seedResult = loadWorld(rawSeed)
