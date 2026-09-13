// HUD windowing — ported from Hermes
export function hudWindowingView(_config: unknown) { return {} }
export function resolveHudWindowing(_platform: string, _env: unknown, _argv: string[]) {
  return { move: 'native-drag' }
}