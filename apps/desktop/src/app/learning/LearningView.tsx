import { useStore } from '@nanostores/react'

import { $learningModules, $learningProgress, completeLesson } from '@/store/learning'

export function LearningView() {
  const modules = useStore($learningModules)
  const progress = useStore($learningProgress)

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const completedLessons = Object.values(progress).reduce((sum, p) => sum + p, 0)
  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {/* Header with overall progress */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Learning</h2>
          <p className="text-sm text-(--ui-text-tertiary)">
            {completedLessons}/{totalLessons} lessons completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-(--ui-bg-elevated)">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium tabular-nums">{overallPercent}%</span>
        </div>
      </div>

      {/* Module list */}
      <div className="flex flex-col gap-3">
        {modules.map(module => {
          const completed = progress[module.id] ?? 0
          const total = module.lessons.length
          const percent = Math.round((completed / total) * 100)
          const isComplete = completed >= total

          return (
            <div
              key={module.id}
              className={`rounded-lg border p-4 transition-colors ${
                isComplete ? 'border-primary/30 bg-primary/5' : 'border-border'
              }`}
            >
              {/* Module header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isComplete
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-(--ui-bg-elevated) text-(--ui-text-tertiary)'
                    }`}
                  >
                    {isComplete ? '✓' : ''}
                  </span>
                  <h3 className={`font-medium ${isComplete ? 'text-primary' : ''}`}>{module.title}</h3>
                </div>
                <span className="text-xs tabular-nums text-(--ui-text-tertiary)">
                  {completed}/{total}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--ui-bg-elevated)">
                <div
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-primary' : 'bg-primary/60'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Lessons */}
              <div className="mt-3 flex flex-col gap-1.5">
                {module.lessons.map((lesson, i) => {
                  const lessonDone = i < completed
                  const lessonCurrent = i === completed

                  return (
                    <button
                      key={i}
                      onClick={() => !lessonDone && completeLesson(module.id, i)}
                      disabled={lessonDone}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                        lessonDone
                          ? 'cursor-default text-(--ui-text-tertiary) line-through'
                          : lessonCurrent
                            ? 'bg-accent/50 text-accent-foreground'
                            : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)'
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${
                          lessonDone
                            ? 'border-primary bg-primary'
                            : 'border-(--ui-text-tertiary)'
                        } flex items-center justify-center`}
                      >
                        {lessonDone && (
                          <svg viewBox="0 0 10 10" className="h-2 w-2 fill-primary-foreground">
                            <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{lesson}</span>
                      {lessonCurrent && !lessonDone && (
                        <span className="ml-auto shrink-0 text-[0.625rem] uppercase tracking-wide text-primary">
                          Next
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {modules.length === 0 && (
        <div className="flex h-32 items-center justify-center text-sm text-(--ui-text-tertiary)">
          No learning modules available.
        </div>
      )}
    </div>
  )
}
