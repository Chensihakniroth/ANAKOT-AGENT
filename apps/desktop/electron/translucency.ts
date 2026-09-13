// Translucency — ported from Hermes
export interface TranslucencyState { enabled: boolean; opacity: number }
export function hudFrostFor(_state: TranslucencyState): string {
  return 'none'
}