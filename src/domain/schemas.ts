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

/**
 * Overall profile level (decided 12 Nov 2026). Private: approved followers only. Public: anyone with
 * the link, QR code or exact @handle. Discoverable: also found in search and suggestions.
 * New adult pilots start Public; minors are always Private.
 */
export const profileLevelSchema = z.enum(['private', 'public', 'discoverable'])

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
  /** Logbook total entered at sign-up. Labeled self-reported until verified by a logbook upload. */
  totalHours: z.number().nonnegative(),
  hoursSource: z.enum(['self_reported', 'logbook_verified']),
  /** Date of the last flight review (14 CFR 61.56), as entered by the pilot. Shown as information, never as currency. */
  flightReviewOn: isoDate.nullable(),
  cfi: cfiProfileSchema.nullable(),
  isMinor: z.boolean(),
  profileLevel: profileLevelSchema,
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
  country: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationFt: z.number(),
})

const isoDateTime = z.iso.datetime()
const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

export const landingSchema = z.object({
  /** Null when the landing was not within range of any known airport. */
  icao: icao.nullable(),
  kind: z.enum(['full_stop', 'touch_and_go']),
  lon: z.number(),
  lat: z.number(),
  at: isoDateTime.nullable(),
})

export const flightStatsSchema = z.object({
  distanceNm: z.number().nonnegative(),
  durationSec: z.number().nonnegative().nullable(),
  airborneSec: z.number().nonnegative().nullable(),
  maxAltitudeFt: z.number().nullable(),
  maxGroundspeedKt: z.number().nonnegative().nullable(),
})

/** A person tagged on a flight (instructor or "flew with"). The tag shows only once they accept it. */
export const tagSchema = z.object({
  accountId: id,
  status: z.enum(['pending', 'accepted', 'declined']),
})

export const flightSchema = z.object({
  id,
  pilotId: id,
  title: z.string().min(1),
  startedAt: isoDateTime.nullable(),
  /** Where the track came from: the export app and the GPS source it reported. */
  source: z.object({
    fileName: z.string(),
    app: z.string().nullable(),
    gpsSource: z.string().nullable(),
  }),
  isSimulator: z.boolean(),
  stats: flightStatsSchema,
  departure: icao.nullable(),
  arrival: icao.nullable(),
  landings: z.array(landingSchema),
  /** Simplified route for display and storage; never the raw track. */
  route: z.array(lonLat).min(2),
  /** Notes from import, e.g. "3 GPS glitches removed". */
  importNotes: z.array(z.string()),
  caption: z.string(),
  /** full: whole route; hide_ends: first/last 1 nm hidden; hidden: no map shown to others. */
  routeVisibility: z.enum(['full', 'hide_ends', 'hidden']),
  /** School or club this flight is tagged to, e.g. a school's simulator session. */
  clubId: id.nullable(),
  /**
   * Simulator sessions tagged to a school need the school's confirmation (an admin or staff CFI)
   * before they count toward XP. Null for real flights and untagged sessions.
   */
  simConfirmation: z
    .object({
      status: z.enum(['pending', 'confirmed', 'declined']),
      byAccountId: id.nullable(),
      at: isoDateTime.nullable(),
    })
    .nullable(),
  postVisibility: z.enum(['public', 'followers', 'private']),
  /** The CFI who instructed on this flight. Must be a verified CFI other than the pilot. */
  instructor: tagSchema.nullable(),
  /** Co-pilot, safety pilot or passenger on Flightpath. */
  flewWith: z.array(tagSchema),
  createdAt: isoDateTime,
})

/**
 * Stored achievements are only the ones someone must verify: training milestones (M2) and
 * missions (M3). Stamps and "candy" badges are derived from flights (see domain/recognition.ts).
 * A stored milestone is the pilot's own (self-reported) claim; a CFI's verification lives in
 * `signoffs`, so revoking a sign-off never deletes what the pilot entered.
 */
export const achievementSchema = z.object({
  id,
  pilotId: id,
  kind: z.enum(['milestone', 'mission']),
  /** Stable key: "milestone:first_solo", "mission:airport_in_the_sky". One per pilot. */
  code: z.string().regex(/^(milestone|mission):[A-Za-z0-9_]+$/),
  title: z.string().min(1),
  icao: icao.nullable(),
  flightId: id.nullable(),
  earnedAt: isoDateTime,
})

/** Training milestones a CFI can sign off. Titles and order live in domain/milestones.ts. */
export const milestoneCodeSchema = z.enum([
  'first_solo',
  'first_solo_xc',
  'private_checkride',
  'instrument_rating',
  'flight_review',
  'ipc',
  'tailwheel',
  'high_performance',
])

export const followSchema = z.object({
  followerId: id,
  followeeId: id,
  /** Following a Private profile needs the owner's approval. */
  status: z.enum(['pending', 'accepted']),
  at: isoDateTime,
})

export const propSchema = z.object({ flightId: id, accountId: id, at: isoDateTime })

export const COMMENT_MAX = 500
export const commentSchema = z.object({
  id,
  flightId: id,
  authorId: id,
  text: z.string().trim().min(1).max(COMMENT_MAX),
  at: isoDateTime,
})

/** Private student–instructor thread on a flight. Only the pilot and the accepted instructor see it. */
export const DEBRIEF_MAX = 2000
export const debriefMessageSchema = z.object({
  id,
  flightId: id,
  authorId: id,
  text: z.string().trim().min(1).max(DEBRIEF_MAX),
  at: isoDateTime,
})

/** A CFI–student relationship; lets the CFI sign off the student's milestones. */
export const cfiLinkSchema = z.object({
  id,
  cfiId: id,
  studentId: id,
  status: z.enum(['active', 'ended']),
  since: isoDate,
})

/**
 * A platform verification by a CFI, never an FAA endorsement. Logged with time, CFI and scope;
 * revocable by the same CFI with a reason. Exactly one of flightId / milestone is set.
 */
export const signoffSchema = z.object({
  id,
  cfiId: id,
  studentId: id,
  flightId: id.nullable(),
  milestone: milestoneCodeSchema.nullable(),
  /** The school the CFI signed for, if any. */
  clubId: id.nullable(),
  note: z.string().max(500),
  /**
   * The CFI confirms the milestone was flown in the school's aircraft. Only then does a
   * milestone sign-off for a School Pro school earn the student XP there (decided 13 Nov 2026).
   */
  schoolAircraft: z.boolean(),
  at: isoDateTime,
  revoked: z.object({ at: isoDateTime, reason: z.string().trim().min(1).max(500) }).nullable(),
})

export const signoffRequestSchema = z.object({
  id,
  studentId: id,
  cfiId: id,
  milestone: milestoneCodeSchema,
  status: z.enum(['open', 'signed', 'declined']),
  at: isoDateTime,
})

export const blockSchema = z.object({ blockerId: id, blockedId: id, at: isoDateTime })

/** Reports are recorded only; a moderation queue is out of scope for the prototype. */
export const reportSchema = z.object({
  id,
  reporterId: id,
  target: z.object({ kind: z.enum(['account', 'flight', 'comment']), id }),
  reason: z.enum(['spam', 'harassment', 'unsafe', 'impersonation', 'other']),
  at: isoDateTime,
})

const missionCode = z.string().regex(/^[a-z0-9_]{2,40}$/)

/**
 * What a track must show for a mission to count as complete. Every listed check must pass.
 * A mission with `cfiOnly` can't be detected from a track; the flight's instructor verifies it.
 */
export const missionRequirementsSchema = z.object({
  /** Lands (full stop or touch-and-go) at any of these airports. */
  landAtAny: z.array(icao).min(1).optional(),
  /** Lands somewhere at least this far, straight-line, from the departure airport. */
  minDistanceFromDepartureNm: z.number().positive().optional(),
  minTotalNm: z.number().positive().optional(),
  /** Distinct airports with full-stop landings, counting the departure airport. */
  minFullStopAirports: z.number().int().min(2).optional(),
  /** Lands at an airport at or above this field elevation. */
  minFieldElevationFt: z.number().optional(),
  cfiOnly: z.boolean(),
})

export const missionSchema = z.object({
  code: missionCode,
  title: z.string().min(1),
  theme: z.enum(['coast', 'urban', 'mountain', 'desert', 'valley', 'training']),
  /** Adventure only / potentially qualifying FAA experience / CFI-verified training. */
  label: z.enum(['adventure', 'potentially_qualifying', 'cfi_verified']),
  story: z.string().min(1),
  objectives: z.array(z.string().min(1)).min(1),
  prerequisites: z.array(z.string().min(1)),
  /** Milestones the pilot should have before the advisor suggests this mission. */
  suggestAfter: z.array(milestoneCodeSchema),
  estMinutes: z.number().int().positive(),
  xp: z.number().int().positive(),
  /** Simulator sessions can count only for sim-eligible missions, once the school confirms them. */
  simEligible: z.boolean(),
  requirements: missionRequirementsSchema,
})

export const pathwaySchema = z.object({
  code: missionCode,
  title: z.string().min(1),
  description: z.string().min(1),
  missionCodes: z.array(missionCode).min(1),
})

/** Opt-in, no leaderboards, no countdown pressure. */
export const challengeSchema = z.object({
  code: missionCode,
  title: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['new_airports', 'states', 'no_go']),
  /** new_airports: how many; no_go: how many recorded no-gos. */
  target: z.number().int().positive().nullable(),
  /** states: all of these, from landings since joining. */
  states: z.array(z.string().length(2)),
})

export const challengeEntrySchema = z.object({ pilotId: id, challengeCode: missionCode, joinedAt: isoDateTime })

/** A flight the pilot decided not to make. Recognized with a "Good Call" badge; never XP. */
export const noGoSchema = z.object({
  id,
  pilotId: id,
  from: icao,
  to: icao.nullable(),
  reason: z.string().trim().min(1).max(500),
  at: isoDateTime,
})

/**
 * A school (or, for CFI-only missions, the flight's instructor) verifying a completed mission.
 * Only this is stored; completion itself is worked out from the track. XP counts only when the
 * club is a claimed School Pro school and the flight was tagged to it (flown in its aircraft).
 */
export const missionVerificationSchema = z.object({
  id,
  pilotId: id,
  missionCode,
  /** Null when the school verifies a mission the pilot self-reported without a track. */
  flightId: id.nullable(),
  clubId: id.nullable(),
  /**
   * Flown in the school's aircraft. For a tracked flight this is the flight's tag to the school;
   * for a self-reported mission the verifier confirms it. XP counts only when true.
   */
  schoolAircraft: z.boolean(),
  byAccountId: id,
  at: isoDateTime,
  revoked: z.object({ at: isoDateTime, reason: z.string().trim().min(1).max(500) }).nullable(),
})

/** A pilot's own report that they flew a mission (e.g. no track recorded). Shown as self-reported. */
export const missionClaimSchema = z.object({ pilotId: id, missionCode, at: isoDateTime })

export const worldSchema = z.object({
  accounts: z.array(accountSchema).min(1),
  clubs: z.array(clubSchema),
  memberships: z.array(membershipSchema),
  airports: z.array(airportSchema).min(1),
  flights: z.array(flightSchema),
  achievements: z.array(achievementSchema),
  follows: z.array(followSchema),
  props: z.array(propSchema),
  comments: z.array(commentSchema),
  debriefs: z.array(debriefMessageSchema),
  cfiLinks: z.array(cfiLinkSchema),
  signoffs: z.array(signoffSchema),
  signoffRequests: z.array(signoffRequestSchema),
  blocks: z.array(blockSchema),
  reports: z.array(reportSchema),
  missions: z.array(missionSchema),
  pathways: z.array(pathwaySchema),
  challenges: z.array(challengeSchema),
  challengeEntries: z.array(challengeEntrySchema),
  noGos: z.array(noGoSchema),
  missionVerifications: z.array(missionVerificationSchema),
  missionClaims: z.array(missionClaimSchema),
})
