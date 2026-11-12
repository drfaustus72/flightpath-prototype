import { z } from 'zod'

/**
 * Zod schemas are the single source of truth for the data model.
 * Types are inferred from them (see types.ts) so seed validation and
 * compile-time types can never drift apart.
 */

const id = z.string().min(1)
const isoDate = z.iso.date()
export const icao = z.string().regex(/^[A-Z0-9]{3,4}$/, 'ICAO/FAA identifier, e.g. KHHR or L35')

export const visibilitySchema = z.enum(['public', 'followers', 'club', 'private'])

export const profileFieldSchema = z.enum([
  'homeAirport',
  'certificates',
  'totalHours',
  'homeSchool',
  'achievements',
  'activity',
  'airportMap',
])

export const certificateSchema = z.enum([
  'student',
  'sport',
  'recreational',
  'private',
  'instrument',
  'commercial',
  'multi_engine',
  'atp',
])

export const cfiRatingSchema = z.enum(['CFI', 'CFII', 'MEI'])

export const cfiProfileSchema = z.object({
  /** Matched against the FAA Airmen Registry. Unverified CFIs get no CFI features. */
  verified: z.boolean(),
  ratings: z.array(cfiRatingSchema).min(1),
  independent: z.boolean(),
})

export const subscriptionSchema = z.object({
  /** Paid by the pilot. A school-sponsored seat is modeled via a membership, not here. */
  pilotPro: z.boolean(),
  /** Paid by the CFI. Staff CFIs of a School Pro school get CFI Pro via their membership. */
  cfiPro: z.boolean(),
})

export const demoPersonaSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().nonnegative(),
})

export const accountSchema = z.object({
  id,
  displayName: z.string().min(1),
  handle: z.string().regex(/^[a-z0-9_]{2,30}$/),
  bio: z.string(),
  homeAirport: icao,
  certificates: z.array(certificateSchema),
  totalHours: z.number().nonnegative(),
  cfi: cfiProfileSchema.nullable(),
  isMinor: z.boolean(),
  /** Partial: fields not listed use the product defaults from the brief. */
  visibility: z.partialRecord(profileFieldSchema, visibilitySchema),
  subscription: subscriptionSchema,
  demoPersona: demoPersonaSchema.nullable(),
})

export const clubPlanSchema = z.enum(['school_basic', 'school_pro', 'community'])

export const clubSchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(['flight_school', 'flying_club', 'community']),
  plan: clubPlanSchema,
  /** Unclaimed pages are created from directory data until the school claims them. */
  claimed: z.boolean(),
  homeAirport: icao,
  website: z.url().nullable(),
  initials: z.string().min(1).max(3),
})

export const membershipRoleSchema = z.enum(['member', 'staff_cfi', 'admin'])

export const membershipSchema = z.object({
  id,
  accountId: id,
  clubId: id,
  roles: z.array(membershipRoleSchema).min(1),
  status: z.enum(['active', 'pending', 'former']),
  isHomeSchool: z.boolean(),
  /** True when a School Pro school pays for this member's Pilot Pro seat. */
  sponsoredPilotPro: z.boolean(),
  startedOn: isoDate,
  endedOn: isoDate.nullable(),
})

export const airportSchema = z.object({
  icao,
  name: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationFt: z.number(),
})

export const worldSchema = z.object({
  accounts: z.array(accountSchema).min(1),
  clubs: z.array(clubSchema),
  memberships: z.array(membershipSchema),
  airports: z.array(airportSchema).min(1),
})
