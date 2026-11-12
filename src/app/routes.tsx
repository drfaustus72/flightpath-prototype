import { Navigate, type RouteObject } from 'react-router'
import { ExploreScreen } from '../features/explore/ExploreScreen'
import { FeedScreen } from '../features/feed/FeedScreen'
import { FlightScreen } from '../features/flight/FlightScreen'
import { LogFlightScreen } from '../features/log/LogFlightScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { SchoolConsoleScreen } from '../features/school/SchoolConsoleScreen'
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
      { path: 'flights/:flightId', element: <FlightScreen /> },
      { path: 'school/:clubId', element: <SchoolConsoleScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
