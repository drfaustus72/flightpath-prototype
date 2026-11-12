import { describe, expect, it } from 'vitest'
import { makeMembership } from '../test/factories'
import { canConfirmSimSession } from './achievements'

describe('canConfirmSimSession', () => {
  const flight = { pilotId: 'acct-test', isSimulator: true, clubId: 'club-s', simConfirmation: { status: 'pending' as const, byAccountId: null, at: null } }
  const role = (accountId: string, roles: ('member' | 'staff_cfi' | 'admin')[]) => makeMembership({ id: `m-${accountId}`, accountId, clubId: 'club-s', roles })

  it('lets an admin or staff CFI of the tagged school confirm', () => {
    expect(canConfirmSimSession(flight, 'acct-admin', [role('acct-admin', ['admin'])])).toBe(true)
    expect(canConfirmSimSession(flight, 'acct-cfi', [role('acct-cfi', ['staff_cfi'])])).toBe(true)
  })
  it('refuses ordinary members, the pilot themself and real flights', () => {
    expect(canConfirmSimSession(flight, 'acct-other', [role('acct-other', ['member'])])).toBe(false)
    expect(canConfirmSimSession(flight, 'acct-test', [role('acct-test', ['admin'])])).toBe(false)
    expect(canConfirmSimSession({ ...flight, isSimulator: false, simConfirmation: null }, 'acct-admin', [role('acct-admin', ['admin'])])).toBe(false)
  })
})
