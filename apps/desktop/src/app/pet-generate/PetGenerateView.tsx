import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Codicon } from '@/components/ui/codicon'
import {
  $petGenerating,
  generatePet,
  listPets,
  setActivePet,
} from '@/store/pet-generate'

const STYLES = [
  { id: 'cute', label: 'Cute', icon: 'symbol-color' },
  { id: 'cool', label: 'Cool', icon: 'symbol-misc' },
  { id: 'robotic', label: 'Robotic', icon: 'robot' },
  { id: 'magical', label: 'Magical', icon: 'sparkle' },
]

interface PetItem {
  slug: string
  name: string
}

export function PetGenerateView() {
  const generating = useStore($petGenerating)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cute')
  const [pets, setPets] = useState<PetItem[]>([])
  const [activePet, setActivePetSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justGenerated, setJustGenerated] = useState<string | null>(null)

  // Load existing pets on mount
  useEffect(() => {
    void listPets().then(setPets)
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setError(null)
    setJustGenerated(null)

    const result = await generatePet({ prompt, style })
    if (result.success) {
      setJustGenerated(result.slug ?? null)
      // Refresh pet list
      const updatedPets = await listPets()
      setPets(updatedPets)
      if (result.slug) {
        await setActivePet(result.slug)
        setActivePetSlug(result.slug)
      }
    } else {
      setError('Failed to generate pet. Please try again.')
    }
  }

  const handleSetActive = async (slug: string) => {
    const ok = await setActivePet(slug)
    if (ok) setActivePetSlug(slug)
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Pet Generator</h2>
        <p className="text-sm text-(--ui-text-tertiary)">Create a companion for your workspace</p>
      </div>

      {/* Style selector */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-(--ui-text-tertiary)">
          Style
        </label>
        <div className="flex gap-2">
          {STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${
                style === s.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)'
              }`}
            >
              <Codicon name={s.icon} size="0.875rem" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt input */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-(--ui-text-tertiary)">
          Description
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="A fluffy cat wearing a top hat..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleGenerate()
              }
            }}
            className="h-9"
          />
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            size="sm"
            className="shrink-0"
          >
            {generating ? (
              <>
                <Codicon name="loading" size="0.875rem" spinning />
                <span className="ml-1.5">Generating...</span>
              </>
            ) : (
              <>
                <Codicon name="sparkle" size="0.875rem" />
                <span className="ml-1.5">Generate</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Just generated preview */}
      {justGenerated && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <Codicon name="check" size="1.25rem" className="text-primary" />
            <div>
              <p className="font-medium text-primary">Pet generated!</p>
              <p className="text-sm text-(--ui-text-tertiary)">{justGenerated}</p>
            </div>
          </div>
        </div>
      )}

      {/* Existing pets gallery */}
      {pets.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-(--ui-text-tertiary)">
            Your Pets ({pets.length})
          </label>
          <div className="grid grid-cols-3 gap-2">
            {pets.map(pet => (
              <button
                key={pet.slug}
                onClick={() => void handleSetActive(pet.slug)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                  activePet === pet.slug
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-(--chrome-action-hover)'
                }`}
              >
                <Codicon name="squirrel" size="1.5rem" className="text-(--ui-text-secondary)" />
                <span className="truncate text-xs">{pet.name}</span>
                {activePet === pet.slug && (
                  <span className="text-[0.625rem] font-medium uppercase tracking-wide text-primary">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {generating && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
    </div>
  )
}
