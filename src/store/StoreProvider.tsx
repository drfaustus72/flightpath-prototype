import { useState, type ReactNode } from 'react'
import type { World } from '../domain/types'
import { createAppStore } from './appStore'
import { StoreContext } from './storeContext'

export function StoreProvider({ world, children }: { world: World; children: ReactNode }) {
  const [store] = useState(() => createAppStore(world))
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
