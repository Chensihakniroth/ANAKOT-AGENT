import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Check, X, Play, Square, Trash2, Download } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Pill } from '@/app/settings/primitives'
import {
  $localModels,
  $localRuntimes,
  $localModelsLoading,
  loadLocalModels,
  startRuntime,
  stopRuntime,
  deleteModel,
  type LocalRuntime
} from '@/store/local-models'

function RuntimePill({ runtime }: { runtime: LocalRuntime }) {
  if (runtime.status === 'running') {
    return (
      <Pill tone="primary">
        <Check className="size-3" />
        Running
      </Pill>
    )
  }
  if (runtime.status === 'stopped') {
    return (
      <Pill tone="muted">
        <X className="size-3" />
        Stopped
      </Pill>
    )
  }
  return (
    <Pill tone="muted">
      <X className="size-3" />
      Not installed
    </Pill>
  )
}

export function LocalModelsPanel() {
  const models = useStore($localModels)
  const runtimes = useStore($localRuntimes)
  const loading = useStore($localModelsLoading)

  useEffect(() => {
    void loadLocalModels()
  }, [])

  if (loading && models.length === 0 && runtimes.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Runtimes */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Runtimes
        </h4>
        <div className="space-y-2">
          {runtimes.map(runtime => (
            <div
              key={runtime.type}
              className="flex items-center gap-3 rounded-lg border border-(--ui-stroke-tertiary) p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{runtime.name}</span>
                  <RuntimePill runtime={runtime} />
                </div>
                {runtime.version && (
                  <p className="mt-0.5 text-xs text-muted-foreground">v{runtime.version}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {runtime.status === 'not_installed' ? (
                  <a
                    href="https://ollama.ai"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Button size="sm" variant="text">
                      Install
                    </Button>
                  </a>
                ) : runtime.status === 'running' ? (
                  <Button onClick={() => stopRuntime(runtime.type as 'ollama' | 'llama.cpp')} size="sm" variant="text">
                    <Square className="size-3.5 mr-1" />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={() => startRuntime(runtime.type as 'ollama' | 'llama.cpp')} size="sm" variant="text">
                    <Play className="size-3.5 mr-1" />
                    Start
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Models */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Models ({models.length})
        </h4>
        {models.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">
            No models downloaded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {models.map(model => (
              <div
                key={model.id}
                className="flex items-center gap-3 rounded-lg border border-(--ui-stroke-tertiary) p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    <Pill tone="muted">{model.runtime}</Pill>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{model.size}</p>
                </div>

                <Button onClick={() => deleteModel(model.id)} size="sm" variant="text" className="text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
