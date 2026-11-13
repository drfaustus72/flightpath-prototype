import type { Account, Club, Membership } from '../domain/types'

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
    cfi: { verified: true, ratings: ['CFI'], independent: true },
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
