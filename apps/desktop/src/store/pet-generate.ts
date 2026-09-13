import { atom } from 'nanostores'

import { gatewayRpc } from '@/lib/gateway-rpc'

// Pet generate — ported from Hermes with real gateway integration
export const $petGenerating = atom(false)

export interface PetGenerateOptions {
  style?: string
  prompt?: string
  slug?: string
}

export async function generatePet(options: PetGenerateOptions): Promise<{ success: boolean; slug?: string }> {
  $petGenerating.set(true)
  try {
    const result = await gatewayRpc<{ ok?: boolean; slug?: string }>('pet.generate', {
      style: options.style || 'cute',
      prompt: options.prompt || '',
      slug: options.slug,
    })
    return { success: result.ok ?? false, slug: result.slug }
  } catch {
    return { success: false }
  } finally {
    $petGenerating.set(false)
  }
}

export async function listPets(): Promise<Array<{ slug: string; name: string }>> {
  try {
    const result = await gatewayRpc<{ pets?: Array<{ slug: string; name: string }> }>('pet.list')
    return result.pets || []
  } catch {
    return []
  }
}

export async function setActivePet(slug: string): Promise<boolean> {
  try {
    const result = await gatewayRpc<{ ok?: boolean }>('pet.set', { slug })
    return result.ok ?? false
  } catch {
    return false
  }
}
