// Learning module — ported from Hermes
export interface LearningModule { id: string; title: string; lessons: string[] }
export function getLearningModules(): LearningModule[] { return [] }
export function getLearningProgress(): Record<string, number> { return {} }