import { atom } from 'nanostores'

export interface ComputerUseStatus {
  available: boolean
  loading: boolean
  platform: string
}

export const $computerUseStatus = atom<ComputerUseStatus>({
  available: false,
  loading: true,
  platform: ''
})

export async function loadComputerUseStatus(): Promise<void> {
  $computerUseStatus.set({ ...$computerUseStatus.get(), loading: true })
  try {
    const result = await window.anakotDesktop?.computerUse?.check()
    $computerUseStatus.set({
      available: result?.available ?? false,
      loading: false,
      platform: result?.platform ?? ''
    })
  } catch {
    $computerUseStatus.set({
      available: false,
      loading: false,
      platform: ''
    })
  }
}
