import { atom } from 'nanostores'
export const $billingBlocked = atom(false)
export function setBillingBlocked(blocked: boolean) { $billingBlocked.set(blocked) }