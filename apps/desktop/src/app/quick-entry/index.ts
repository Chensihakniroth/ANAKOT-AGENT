// Quick entry — ported from Hermes
export interface QuickEntryAction { id: string; label: string; run: () => void }
export function getQuickEntryActions(): QuickEntryAction[] { return [] }