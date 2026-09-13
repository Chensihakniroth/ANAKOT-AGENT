// Backend health — ported from Hermes
export async function checkBackendHealth(): Promise<{ healthy: boolean }> {
  return { healthy: true }
}