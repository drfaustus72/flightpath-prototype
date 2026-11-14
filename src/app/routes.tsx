import { Navigate, type RouteObject } from 'react-router'
import { InboxScreen } from '../features/cfi/InboxScreen'
import { ClubScreen } from '../features/clubs/ClubScreen'
import { AirportScreen } from '../features/explore/AirportScreen'
import { NearbyScreen } from '../features/explore/NearbyScreen'
import { MapScreen } from '../features/map/MapScreen'
import { MissionScreen, MissionsScreen } from '../features/missions/MissionsScreen'
import { ExploreScreen } from '../features/explore/ExploreScreen'
import { FeedScreen } from '../features/feed/FeedScreen'
import { FlightScreen } from '../features/flight/FlightScreen'
import { LogFlightScreen } from '../features/log/LogFlightScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { PublicProfileScreen } from '../features/profile/PublicProfileScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { SchoolLayout } from '../features/school/SchoolLayout'
import { SchoolDashboardScreen, SchoolHomeScreen, SchoolIndex, SchoolPageScreen, SchoolQueueScreen } from '../features/school/SchoolScreens'
import { AppLayout } from './AppLayout'
import { NotFoundScreen } from './NotFoundScreen'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/feed" replace /> },
      { path: 'feed', element: <FeedScreen /> },
      { path: 'explore', element: <ExploreScreen /> },
      { path: 'log', element: <LogFlightScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
      { path: 'inbox', element: <InboxScreen /> },
      { path: 'missions', element: <MissionsScreen /> },
      { path: 'clubs/:clubId', element: <ClubScreen /> },
      { path: 'airports/:icao', element: <AirportScreen /> },
      { path: 'nearby', element: <NearbyScreen /> },
      { path: 'map', element: <MapScreen /> },
      { path: 'missions/:code', element: <MissionScreen /> },
      { path: 'u/:handle', element: <PublicProfileScreen /> },
      { path: 'flights/:flightId', element: <FlightScreen /> },
      { path: 'school', element: <SchoolHomeScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
  {
    // A school's own space: its staff act as the school here, with the school's tabs.
    path: 'school/:clubId',
    element: <SchoolLayout />,
    children: [
      { index: true, element: <SchoolIndex /> },
      { path: 'dashboard', element: <SchoolDashboardScreen /> },
      { path: 'queue', element: <SchoolQueueScreen /> },
      { path: 'page', element: <SchoolPageScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
