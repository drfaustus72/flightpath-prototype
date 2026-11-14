import { ChartColumn, Globe, ListChecks, Users } from 'lucide-react'
import { Navigate, useParams } from 'react-router'
import { ActingAs } from '../../app/ActingAs'
import { Shell, type Tab } from '../../app/Shell'
import { schoolQueue, schoolQueueCount } from '../../domain/schoolAdmin'
import { canInClub } from '../../domain/tiers'
import { useActive, useWorld } from '../../store/hooks'

/**
 * A school's own space, for its staff. Admins and staff CFIs act as the school here; what each
 * can do comes from `schoolPermissions.ts`. Anyone else is sent to the school's public page.
 */
export function SchoolLayout() {
  const { clubId = '' } = useParams()
  const world = useWorld()
  const { account, access } = useActive()
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club || !canInClub(access, 'school.queue', clubId)) return <Navigate to={club ? `/clubs/${clubId}` : '/feed'} replace />

  const base = `/school/${club.id}`
  const tabs: Tab[] = [
    ...(canInClub(access, 'school.dashboard', club.id)
      ? [{ to: `${base}/dashboard`, label: 'Dashboard', icon: <ChartColumn size={22} aria-hidden="true" /> }]
      : []),
    { to: `${base}/queue`, label: 'Queue', icon: <ListChecks size={22} aria-hidden="true" />, count: schoolQueueCount(schoolQueue(world, account.id, club)) },
    ...(canInClub(access, 'school.members', club.id)
      ? [{ to: `${base}/members`, label: 'Members', icon: <Users size={22} aria-hidden="true" /> }]
      : []),
    { to: `${base}/page`, label: 'Page', icon: <Globe size={22} aria-hidden="true" /> },
  ]

  return (
    <Shell
      title={
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[12px] font-semibold text-ink-muted">Acting as</span>
          <span className="truncate text-[16px] font-extrabold tracking-tight">{club.name}</span>
        </span>
      }
      actingAs={<ActingAs current={club} />}
      tabs={tabs}
      navLabel={`${club.name} school`}
    />
  )
}
