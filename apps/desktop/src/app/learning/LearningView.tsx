
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { $learningModules, $learningProgress, completeLesson } from '@/store/learning'

export function LearningView() {
  const modules = useStore($learningModules)
  const progress = useStore($learningProgress)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  const selected = modules.find(m => m.id === selectedModule)

  return (
    <div className="flex h-full gap-4 p-4">
      <div className="w-64 flex-shrink-0 overflow-y-auto border-r pr-4">
        <h2 className="mb-4 font-semibold">Learning Modules</h2>
        <div className="flex flex-col gap-2">
          {modules.map(module => (
            <button
              key={module.id}
              onClick={() => setSelectedModule(module.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selectedModule === module.id ? 'bg-accent' : 'hover:bg-muted'
              }`}
            >
              <h3 className="font-medium">{module.title}</h3>
              <p className="text-xs text-muted-foreground">
                {progress[module.id] ?? 0}/{module.lessons.length} lessons
              </p>
            </button>
          ))}
          {modules.length === 0 && (
            <p className="text-sm text-muted-foreground">No modules available</p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div>
            <h2 className="mb-4 text-xl font-semibold">{selected.title}</h2>
            <div className="flex flex-col gap-2">
              {selected.lessons.map((lesson, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <span>{lesson}</span>
                  <button
                    onClick={() => completeLesson(selected.id, i)}
                    className="text-sm text-primary hover:underline"
                  >
                    Complete
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a module to begin learning
          </div>
        )}
      </div>
    </div>
  )
}
