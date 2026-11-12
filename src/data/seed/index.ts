import { loadWorld } from '../../domain/world'
import accounts from './accounts.json'
import airports from './airports.json'
import achievements from './achievements.json'
import clubs from './clubs.json'
import flights from './flights.json'
import memberships from './memberships.json'

export const rawSeed = { accounts, clubs, memberships, airports, flights, achievements }

/** Validated once at startup. The app renders an error screen if this fails. */
export const seedResult = loadWorld(rawSeed)
