import type { Account, Club, Flight, Membership, World } from '../domain/types'

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acct-test',
    displayName: 'Test Pilot',
    handle: 'test_pilot',
    bio: '',
    homeAirport: 'KHHR',
    certificates: ['student'],
    totalHours: 10,
    hoursSource: 'self_reported',
    flightReviewOn: null,
    cfi: null,
    isMinor: false,
    profileLevel: 'public',
    visibility: {},
    subscription: { pilotPro: false, cfiPro: false },
    demoPersona: null,
    ...overrides,
  }
}

export function makeCfi(overrides: Partial<Account> = {}): Account {
  return makeAccount({
    id: 'acct-cfi',
    displayName: 'Test CFI',
    handle: 'test_cfi',
    certificates: ['private', 'instrument', 'commercial'],
    totalHours: 900,
    cfi: { verified: true, ratings: ['CFI'], independent: true, listed: true },
    ...overrides,
  })
}

export function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-test',
    name: 'Test Flight School',
    kind: 'flight_school',
    plan: 'school_pro',
    claimed: true,
    homeAirport: 'KHHR',
    website: null,
    initials: 'TF',
    about: '',
    trainingOffered: ['private'],
    ...overrides,
  }
}

export function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'mem-test',
    accountId: 'acct-test',
    clubId: 'club-test',
    roles: ['member'],
    status: 'active',
    isHomeSchool: false,
    sponsoredPilotPro: false,
    startedOn: '2026-01-01',
    endedOn: null,
    ...overrides,
  }
}

const straightRoute: [number, number][] = Array.from({ length: 11 }, (_, i) => [-118.335 + i * 0.02, 33.9228])

export function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    id: 'flt-test',
    pilotId: 'acct-test',
    title: 'Test flight',
    startedAt: '2026-11-08T17:00:00.000Z',
    source: { fileName: 'x.gpx', app: null, gpsSource: null },
    isSimulator: false,
    stats: { distanceNm: 10, durationSec: 600, airborneSec: 500, maxAltitudeFt: 3000, maxGroundspeedKt: 110 },
    departure: 'KHHR',
    arrival: 'KHHR',
    landings: [],
    route: straightRoute,
    importNotes: [],
    caption: '',
    routeVisibility: 'full',
    clubId: null,
    simConfirmation: null,
    postVisibility: 'public',
    instructor: null,
    flewWith: [],
    createdAt: '2026-11-08T18:00:00.000Z',
    ...overrides,
  }
}

/** A small, valid world: no airports beyond KHHR and only what each test adds. */
export function makeWorld(overrides: Partial<World> = {}): World {
  return {
    accounts: [makeAccount()],
    clubs: [],
    memberships: [],
    airports: [
      { icao: 'KHHR', name: 'Jack Northrop Field', city: 'Hawthorne', state: 'CA', country: 'US', lat: 33.9228, lon: -118.335, elevationFt: 66 },
    ],
    flights: [],
    achievements: [],
    follows: [],
    props: [],
    comments: [],
    debriefs: [],
    cfiLinks: [],
    signoffs: [],
    signoffRequests: [],
    blocks: [],
    reports: [],
    missions: [],
    pathways: [],
    challenges: [],
    challengeEntries: [],
    noGos: [],
    missionVerifications: [],
    missionClaims: [],
    ...overrides,
  }
}

export const follow = (followerId: string, followeeId: string, status: 'pending' | 'accepted' = 'accepted') => ({
  followerId,
  followeeId,
  status,
  at: '2026-10-01T00:00:00.000Z',
})
