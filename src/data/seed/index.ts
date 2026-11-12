import { loadWorld } from '../../domain/world'
import accounts from './accounts.json'
import airports from './airports.json'
import clubs from './clubs.json'
import memberships from './memberships.json'

export const rawSeed = { accounts, clubs, memberships, airports }

/** Validated once at startup. The app renders an error screen if this fails. */
export const seedResult = loadWorld(rawSeed)
