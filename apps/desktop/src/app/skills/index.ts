// Skills system — ported from Hermes
export interface Skill { id: string; name: string; description: string }
export function getSkills(): Skill[] { return [] }
export function installSkill(id: string): Promise<boolean> { return Promise.resolve(false) }
export function SkillsView(_props: { setStatusbarItemGroup?: unknown }) { return null }