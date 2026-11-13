import { Link } from 'react-router'
import type { Account } from '../../domain/types'

export function PersonLink({ account, className = '' }: { account: Pick<Account, 'handle' | 'displayName'>; className?: string }) {
  return (
    <Link to={`/u/${account.handle}`} className={`font-semibold underline-offset-2 hover:underline ${className}`}>
      {account.displayName}
    </Link>
  )
}
