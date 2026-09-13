import { atom } from 'nanostores'
// Pet generate — ported from Hermes
export const $petGenerating = atom(false)
export interface PetGenerateOptions { style?: string; prompt?: string }
export async function generatePet(_options: PetGenerateOptions): Promise<{ success: boolean }> {
  $petGenerating.set(true)
  try { return { success: false } } finally { $petGenerating.set(false) }
}