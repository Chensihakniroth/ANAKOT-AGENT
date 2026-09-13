
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { $petGenerating, generatePet } from '@/store/pet-generate'

export function PetGenerateView() {
  const generating = useStore($petGenerating)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cute')

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    await generatePet({ prompt, style })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold">Generate a Pet</h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Style</label>
          <div className="flex gap-2">
            {['cute', 'cool', 'robotic', 'magical'].map(s => (
              <Button
                key={s}
                variant={style === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStyle(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Description</label>
          <Input
            placeholder="Describe your pet..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
          {generating ? 'Generating...' : 'Generate Pet'}
        </Button>
      </div>
    </div>
  )
}
