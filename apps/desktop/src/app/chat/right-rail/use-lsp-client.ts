import { useEffect, useRef, useState } from 'react'
import { LspClient } from '@/lib/lsp-client'
import { $currentCwd } from '@/store/session'

/**
 * React hook to manage an LSP client for Monaco editor.
 */
export function useLspClient(
  monaco: any,
  language: string,
  filePath?: string
) {
  const [client, setClient] = useState<LspClient | null>(null)
  const hoverProviderRef = useRef<any>(null)
  const completionProviderRef = useRef<any>(null)

  useEffect(() => {
    if (!monaco || !language) return

    let isMounted = true
    let lspClient: LspClient | null = null

    // Determine a rough root path for LSP.
    // Usually this is the default project dir or the directory of the file.
    const rootPath = $currentCwd.get() || ''

    async function init() {
      // 1. Check if an LSP is available for this language
      const available = await window.anakotDesktop.lsp.available()
      
      // If we don't have a configured server, fallback silently.
      // E.g. we might have language 'javascript' mapped to 'typescript-language-server'.
      // The backend manager knows the mapping, we just need to try starting it.
      
      lspClient = new LspClient(language, rootPath, monaco)
      const started = await lspClient.start()
      
      if (started && isMounted) {
        setClient(lspClient)

        // Register Providers
        hoverProviderRef.current = monaco.languages.registerHoverProvider(language, {
          provideHover: (model: any, position: any) => lspClient!.provideHover(model, position)
        })

        completionProviderRef.current = monaco.languages.registerCompletionItemProvider(language, {
          provideCompletionItems: (model: any, position: any) => lspClient!.provideCompletionItems(model, position)
        })

        if (filePath) {
          lspClient.openDocument(`file:///${filePath.replace(/\\/g, '/')}`, monaco.editor.getModels()[0]?.getValue() || '')
        }
      }
    }

    init()

    return () => {
      isMounted = false
      if (hoverProviderRef.current) hoverProviderRef.current.dispose()
      if (completionProviderRef.current) completionProviderRef.current.dispose()
      if (lspClient) {
        lspClient.stop().catch(console.error)
      }
    }
  }, [monaco, language, filePath])

  return client
}
