
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { $managedUpdates, checkForUpdates, installUpdate } from '@/store/updates'

export function UpdatesOverlay() {
  const updates = useStore($managedUpdates)
  const [checking, setChecking] = useState(false)

  const handleCheck = async () => {
    setChecking(true)
    await checkForUpdates()
    setChecking(false)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold">Updates</h2>
      {updates.available ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-medium">Update Available</h3>
          <p className="text-sm text-muted-foreground">Version {updates.version}</p>
          <button
            onClick={installUpdate}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Install Update
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">Your app is up to date</p>
      )}
      <button
        onClick={handleCheck}
        disabled={checking}
        className="self-start rounded-md border px-4 py-2"
      >
        {checking ? 'Checking...' : 'Check for Updates'}
      </button>
    </div>
  )
}
