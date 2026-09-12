// Desktop filesystem operations — reveal, trash, rename, copy path.
// Used by file trees, review/git tree, and session file browsers.

export function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    const result = window.anakotDesktop?.writeClipboard?.(text)
    return result?.then(() => true).catch(() => false) ?? Promise.resolve(false)
  } catch {
    return Promise.resolve(false)
  }
}

export function revealDesktopPath(path: string): Promise<{ ok: boolean }> {
  const result = window.anakotDesktop?.revealPath?.(path)
  if (!result) return Promise.resolve({ ok: false })
  return result.then(ok => ({ ok }))
}

export function trashDesktopPath(path: string): Promise<{ ok: boolean }> {
  const api = (window.anakotDesktop as Record<string, unknown>)?.trashPath as ((p: string) => Promise<boolean>) | undefined
  if (!api) return Promise.resolve({ ok: false })
  return api(path).then(ok => ({ ok }))
}

export function renameDesktopPath(oldPath: string, newPath: string): Promise<{ ok: boolean }> {
  const api = (window.anakotDesktop as Record<string, unknown>)?.renamePath as ((o: string, n: string) => Promise<boolean>) | undefined
  if (!api) return Promise.resolve({ ok: false })
  return api(oldPath, newPath).then(ok => ({ ok }))
}

export function isDesktopFsRemoteMode(): boolean {
  const api = (window.anakotDesktop as Record<string, unknown>)?.isRemoteMode as (() => boolean) | undefined
  return api?.() ?? false
}

export async function downloadGatewayMediaFile(url: string, filename: string): Promise<void> {
  const api = (window.anakotDesktop as Record<string, unknown>)?.downloadFile as ((u: string, f: string) => Promise<unknown>) | undefined
  if (!api) return
  await api(url, filename).catch(() => undefined)
}
