import { atom } from 'nanostores'
export interface FleetMember { id: string; name: string; status: string }
export const $fleetRoster = atom<FleetMember[]>([])