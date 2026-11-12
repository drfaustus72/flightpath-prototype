import { useMemo } from 'react'
import { type AccessContext, accessContextFor } from '../domain/tiers'
import type { Account } from '../domain/types'
import { useAppStore } from './storeContext'

export function useWorld() {
  return useAppStore((s) => s.world)
}

/** The active persona's account and access context. Throws if state is inconsistent. */
export function useActive(): { account: Account; access: AccessContext } {
  const world = useWorld()
  const activeId = useAppStore((s) => s.activeAccountId)
  return useMemo(() => {
    const access = accessContextFor(world, activeId)
    // The store reconciles activeAccountId against the world on load and on every switch.
    if (!access) throw new Error(`Active account ${activeId} not found`)
    return { account: access.account, access }
  }, [world, activeId])
}
