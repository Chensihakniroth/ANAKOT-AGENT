import { atom } from 'nanostores'

export const $sessionImportOpen = atom<boolean>(false)

export const setSessionImportOpen = (open: boolean) => {
  $sessionImportOpen.set(open)
}
