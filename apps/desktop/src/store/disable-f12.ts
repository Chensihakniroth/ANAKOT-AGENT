import { atom } from 'nanostores'
export const $disableF12 = atom(false)
export function setDisableF12(disabled: boolean) { $disableF12.set(disabled) }