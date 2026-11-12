import { Upload } from 'lucide-react'
import { Button, EmptyState, ScreenTitle } from '../../ui/primitives'

export function LogFlightScreen() {
  return (
    <>
      <ScreenTitle>Log flight</ScreenTitle>
      <EmptyState
        title="Upload a track to log a flight"
        body="Export a GPX or KML track from ForeFlight or another app and upload it here. Track upload isn't in this build yet."
        action={
          <Button tone="primary" disabled>
            <Upload size={18} aria-hidden="true" />
            Upload track
          </Button>
        }
      />
    </>
  )
}
