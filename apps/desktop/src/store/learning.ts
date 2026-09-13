import { atom } from 'nanostores'

// Learning module — ported from Hermes
export interface LearningModule {
  id: string
  title: string
  lessons: string[]
}

export const $learningModules = atom<LearningModule[]>([
  {
    id: 'getting-started',
    title: 'Getting Started with Anakot',
    lessons: [
      'Introduction to the Agent',
      'Setting up your first session',
      'Using the chat interface',
      'Keyboard shortcuts',
    ],
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    lessons: [
      'Working with MCP servers',
      'Customizing your workspace',
      'Using the timeline',
      'Managing multiple sessions',
    ],
  },
])

export const $learningProgress = atom<Record<string, number>>({})

export function completeLesson(moduleId: string, lessonIndex: number) {
  const progress = $learningProgress.get()
  const current = progress[moduleId] ?? 0
  if (lessonIndex >= current) {
    $learningProgress.set({ ...progress, [moduleId]: lessonIndex + 1 })
  }
}

export function getLearningProgress(): Record<string, number> {
  return $learningProgress.get()
}
