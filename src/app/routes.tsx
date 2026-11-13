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
import { SchoolConsoleScreen, SchoolHomeScreen } from '../features/school/SchoolConsoleScreen'
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
      { path: 'school/:clubId', element: <SchoolConsoleScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
