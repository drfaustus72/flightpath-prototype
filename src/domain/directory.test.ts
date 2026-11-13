import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { airportForQuery, airportPage, cfiAirports, mapPoints, nearby } from './directory'
import type { World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('airportPage', () => {
  it('lists the schools, CFIs, Discoverable pilots and missions at Hawthorne', () => {
    const p = airportPage(seed(), 'acct-jordan', 'khhr')
    expect(p?.airport.icao).toBe('KHHR')
    expect(ids(p?.clubs ?? [])).toEqual(['club-hfa'])
    expect(ids(p?.cfis ?? [])).toEqual(['acct-dan'])
    // Maya is Public (not Discoverable) and Sam is a minor: neither is listed.
    expect(ids(p?.pilots ?? []).sort()).toEqual(['acct-alex', 'acct-lena'])
  })

  it('lists missions that land there', () => {
    expect(airportPage(seed(), 'acct-jordan', 'KAVX')?.missions.map((m) => m.code)).toEqual(['airport_in_the_sky'])
  })

  it('drops a CFI who turned their listing off, and anyone across a block', () => {
    const w = seed()
    w.accounts = w.accounts.map((a) => (a.id === 'acct-dan' && a.cfi ? { ...a, cfi: { ...a.cfi, listed: false } } : a))
    w.blocks.push({ blockerId: 'acct-lena', blockedId: 'acct-jordan', at: '2026-11-01T00:00:00.000Z' })
    const p = airportPage(w, 'acct-jordan', 'KHHR')
    expect(p?.cfis).toEqual([])
    expect(ids(p?.pilots ?? [])).toEqual(['acct-alex'])
  })

  it('returns null for an unknown airport and matches identifiers in search', () => {
    expect(airportPage(seed(), 'acct-jordan', 'KZZZ')).toBeNull()
    expect(airportForQuery(seed(), ' khhr ')?.icao).toBe('KHHR')
    expect(airportForQuery(seed(), 'kh')).toBeUndefined()
  })
})

describe('nearby', () => {
  it('orders schools and CFIs by distance within the radius, never by plan', () => {
    const r = nearby(seed(), 'acct-jordan', 'KHHR', 10)
    expect(r.clubs.map((c) => c.club.id)).toEqual(['club-hfa', 'club-coastal', 'club-smo'])
    expect(r.clubs[0]?.nm).toBe(0)
    expect(r.cfis.map((c) => c.account.id)).toEqual(['acct-dan', 'acct-kim', 'acct-priya'])
  })

  it('widens with the radius', () => {
    const ten = nearby(seed(), 'acct-jordan', 'KHHR', 10).clubs.length
    const fifty = nearby(seed(), 'acct-jordan', 'KHHR', 50).clubs.length
    expect(fifty).toBeGreaterThan(ten)
  })

  it('filters by training offered, matching CFI ratings', () => {
    const r = nearby(seed(), 'acct-jordan', 'KHHR', 50, 'instrument')
    expect(r.clubs.map((c) => c.club.id)).toEqual(['club-hfa', 'club-smo'])
    expect(r.cfis.map((c) => c.account.id)).toEqual(['acct-dan', 'acct-kim'])
    expect(nearby(seed(), 'acct-jordan', 'KHHR', 50, 'multi_engine').cfis.map((c) => c.account.id)).toEqual(['acct-priya'])
  })

  it('lists a staff CFI at their school’s airport too', () => {
    const w = seed()
    const kim = w.accounts.find((a) => a.id === 'acct-kim')
    if (!kim) throw new Error('kim')
    expect(cfiAirports(w, kim)).toContain('KTOA')
  })
})

describe('mapPoints', () => {
  it('shows pilots only as counts and never counts minors', () => {
    const points = mapPoints(seed(), 'acct-jordan')
    const hhr = points.find((p) => p.airport.icao === 'KHHR')
    // Dan, Alex and Lena are Discoverable; Maya is Public and Sam is a minor.
    expect(hhr?.pilots).toBe(3)
    expect(hhr?.cfis).toBe(1)
    expect(hhr?.clubs.map((c) => c.id)).toEqual(['club-hfa'])
  })
})
