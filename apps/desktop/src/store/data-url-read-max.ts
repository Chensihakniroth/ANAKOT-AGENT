import { atom } from 'nanostores'
export const $dataUrlReadMaxMb = atom(10)
export function setDataUrlReadMaxMb(mb: number) { $dataUrlReadMaxMb.set(mb) }