import { describe, expect, it, vi } from 'vitest'
import { seedResult } from '../data/seed'
import type { World } from '../domain/types'
import { STORAGE_KEY, STORAGE_VERSION, createAppStore } from './appStore'

function seedWorld(): World {
  if (!seedResult.ok) throw new Error('seed invalid')
  return seedResult.world
}

const save = (state: unknown, version = STORAGE_VERSION) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }))

describe('app store', () => {
  it('starts on the first demo persona', () => {
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
  })

  it('switches persona, persists it, and restores it in a new store', () => {
    const a = createAppStore(seedWorld())
    a.getState().setActiveAccount('acct-dan')
    const b = createAppStore(seedWorld())
    expect(b.getState().activeAccountId).toBe('acct-dan')
  })

  it('refuses to switch to an unknown account', () => {
    const store = createAppStore(seedWorld())
    expect(() => store.getState().setActiveAccount('acct-ghost')).toThrow('Unknown account')
  })

  it('resets to seed on demand', () => {
    const store = createAppStore(seedWorld())
    store.getState().setActiveAccount('acct-jordan')
    store.getState().resetDemo()
    expect(store.getState().activeAccountId).toBe('acct-maya')
  })

  it('resets corrupt JSON in storage with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{not json')
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
    expect(warn).toHaveBeenCalled()
  })

  it('resets state saved by an older version', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    save({ world: seedWorld(), activeAccountId: 'acct-dan' }, STORAGE_VERSION - 1)
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
    expect(warn).toHaveBeenCalled()
  })

  it('resets saved state that no longer validates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    save({ world: { accounts: [] }, activeAccountId: 'acct-dan' })
    const store = createAppStore(seedWorld())
    expect(store.getState().world.accounts.length).toBe(seedWorld().accounts.length)
    expect(warn).toHaveBeenCalled()
  })

  it('falls back to the default persona if the saved one no longer exists', () => {
    save({ world: seedWorld(), activeAccountId: 'acct-deleted' })
    const store = createAppStore(seedWorld())
    expect(store.getState().activeAccountId).toBe('acct-maya')
  })
})
