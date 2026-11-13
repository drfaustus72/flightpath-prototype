import { describe, expect, it } from 'vitest'
import { follow, makeAccount, makeCfi, makeClub, makeFlight, makeMembership, makeWorld } from '../test/factories'
import {
  canFollow,
  canGiveProps,
  checkCommentText,
  commentsFor,
  feedFor,
  initialFollowStatus,
  pendingFollowRequests,
  profileFlights,
} from './social'

const a = makeAccount({ id: 'a', handle: 'a' })
const b = makeAccount({ id: 'b', handle: 'b' })
const c = makeAccount({ id: 'c', handle: 'c', profileLevel: 'private' })
const at = (iso: string) => `2026-11-${iso}T12:00:00.000Z`

describe('follows', () => {
  it('needs approval only for Private profiles and minors', () => {
    expect(initialFollowStatus(b)).toBe('accepted')
    expect(initialFollowStatus(c)).toBe('pending')
    expect(initialFollowStatus(makeAccount({ isMinor: true, profileLevel: 'private' }))).toBe('pending')
  })

  it('refuses self-follows, repeats and follows across a block', () => {
    const w = makeWorld({ accounts: [a, b, c], follows: [follow('a', 'b')] })
    expect(canFollow(w, 'a', 'a')).toBe(false)
    expect(canFollow(w, 'a', 'b')).toBe(false)
    expect(canFollow(w, 'a', 'c')).toBe(true)
    expect(canFollow({ ...w, blocks: [{ blockerId: 'c', blockedId: 'a', at: at('01') }] }, 'a', 'c')).toBe(false)
    expect(canFollow(w, 'a', 'ghost')).toBe(false)
  })

  it('lists pending requests for the profile owner', () => {
    const w = makeWorld({ accounts: [a, b, c], follows: [follow('a', 'c', 'pending'), follow('b', 'c')] })
    expect(pendingFollowRequests(w, 'c').map((f) => f.followerId)).toEqual(['a'])
  })
})

describe('Props and comments', () => {
  it("doesn't let pilots give Props to their own flights or to flights they can't see", () => {
    const w = makeWorld({ accounts: [a, b, c] })
    expect(canGiveProps(w, 'a', makeFlight({ pilotId: 'a' }))).toBe(false)
    expect(canGiveProps(w, 'b', makeFlight({ pilotId: 'a' }))).toBe(true)
    expect(canGiveProps(w, 'b', makeFlight({ pilotId: 'c' }))).toBe(false)
  })

  it('trims comments and rejects empty or overlong ones', () => {
    expect(checkCommentText('  nice  ')).toEqual({ ok: true, text: 'nice' })
    expect(checkCommentText('   ').ok).toBe(false)
    expect(checkCommentText('x'.repeat(501)).ok).toBe(false)
  })

  it('hides comments from blocked authors, oldest first', () => {
    const comments = [
      { id: 'c2', flightId: 'f', authorId: 'b', text: 'two', at: at('02') },
      { id: 'c1', flightId: 'f', authorId: 'b', text: 'one', at: at('01') },
      { id: 'c3', flightId: 'f', authorId: 'c', text: 'three', at: at('03') },
    ]
    const w = makeWorld({ accounts: [a, b, c], comments, blocks: [{ blockerId: 'a', blockedId: 'c', at: at('01') }] })
    expect(commentsFor(w, 'a', 'f').map((x) => x.id)).toEqual(['c1', 'c2'])
  })
})

describe('feeds', () => {
  const cfi = makeCfi()
  const flights = [
    makeFlight({ id: 'mine', pilotId: 'a', startedAt: at('01') }),
    makeFlight({ id: 'followed', pilotId: 'b', startedAt: at('03') }),
    makeFlight({ id: 'stranger', pilotId: 'c', startedAt: at('02') }),
    makeFlight({ id: 'taught', pilotId: 'b', startedAt: at('04'), postVisibility: 'private', instructor: { accountId: 'acct-cfi', status: 'accepted' } }),
  ]

  it('shows your flights, people you follow, and flights you were tagged on, newest first', () => {
    const w = makeWorld({ accounts: [a, b, c, cfi], flights, follows: [follow('a', 'b')] })
    expect(feedFor(w, 'a').map((f) => f.id)).toEqual(['followed', 'mine'])
    expect(feedFor(w, 'acct-cfi').map((f) => f.id)).toEqual(['taught'])
  })

  it('shows club flights only for clubs with a feed (School Pro or community)', () => {
    const memberships = [
      makeMembership({ id: 'm1', accountId: 'a', clubId: 'pro' }),
      makeMembership({ id: 'm2', accountId: 'a', clubId: 'basic' }),
    ]
    const clubs = [makeClub({ id: 'pro' }), makeClub({ id: 'basic', plan: 'school_basic' })]
    const clubFlights = [makeFlight({ id: 'p', pilotId: 'b', clubId: 'pro' }), makeFlight({ id: 'q', pilotId: 'b', clubId: 'basic' })]
    const w = makeWorld({ accounts: [a, b], clubs, memberships, flights: clubFlights })
    expect(feedFor(w, 'a', 'clubs').map((f) => f.id)).toEqual(['p'])
  })

  it("hides a profile's flights when activity is not visible to the viewer", () => {
    const owner = makeAccount({ id: 'o', handle: 'o', visibility: { activity: 'followers' } })
    const w = makeWorld({ accounts: [a, owner], flights: [makeFlight({ id: 'x', pilotId: 'o' })] })
    expect(profileFlights(w, 'a', 'o')).toEqual([])
    expect(profileFlights({ ...w, follows: [follow('a', 'o')] }, 'a', 'o').map((f) => f.id)).toEqual(['x'])
  })
})
