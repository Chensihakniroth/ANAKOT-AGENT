// src/lib/lsp-client.ts
// ─────────────────────────────────────────────────────────────────
// Lightweight LSP JSON-RPC client over Electron IPC.
// Connects to the main process LSP manager and provides Monaco
// language feature providers (hover, completion, diagnostics).
// ─────────────────────────────────────────────────────────────────

type LspMessage = 
  | { jsonrpc: '2.0'; id: number; result: any }
  | { jsonrpc: '2.0'; id: number; error: any }
  | { jsonrpc: '2.0'; method: string; params?: any }
  | { jsonrpc: '2.0'; id: number; method: string; params?: any }

export class LspClient {
  private id: string | null = null
  private messageId = 1
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()
  private unsubs: Array<() => void> = []

  constructor(
    public readonly language: string,
    public readonly rootPath: string,
    private readonly monaco: any // the monaco instance from @monaco-editor/react
  ) {}

  async start(): Promise<boolean> {
    try {
      const result = await window.anakotDesktop.lsp.start(this.language, this.rootPath)
      if (result.error || !result.id) {
        console.warn(`[LSP] Failed to start ${this.language}:`, result.error)
        return false
      }
      this.id = result.id

      this.unsubs.push(
        window.anakotDesktop.lsp.onMessage(this.id, (msg: any) => this.handleMessage(msg))
      )
      this.unsubs.push(
        window.anakotDesktop.lsp.onExit(this.id, () => this.handleExit())
      )

      await this.initialize()
      return true
    } catch (err) {
      console.error(`[LSP] Start error:`, err)
      return false
    }
  }

  async stop() {
    if (this.id) {
      await window.anakotDesktop.lsp.stop(this.id)
      this.id = null
    }
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }

  private async request(method: string, params?: any): Promise<any> {
    if (!this.id) throw new Error('LSP not started')
    const id = this.messageId++
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
    })
    
    await window.anakotDesktop.lsp.send(this.id, { jsonrpc: '2.0', id, method, params })
    return promise
  }

  private notify(method: string, params?: any) {
    if (!this.id) return
    window.anakotDesktop.lsp.send(this.id, { jsonrpc: '2.0', method, params }).catch(console.error)
  }

  private handleMessage(msg: LspMessage) {
    if ('id' in msg && msg.id !== undefined) {
      // Response to a request
      const req = this.pendingRequests.get(msg.id)
      if (req) {
        this.pendingRequests.delete(msg.id)
        if ('error' in msg) req.reject(msg.error)
        else if ('result' in msg) req.resolve(msg.result)
      }
    } else if ('method' in msg) {
      // Notification from server (e.g., diagnostics)
      if (msg.method === 'textDocument/publishDiagnostics') {
        this.publishDiagnostics(msg.params)
      }
    }
  }

  private handleExit() {
    
    this.id = null
  }

  private async initialize() {
    const initResult = await this.request('initialize', {
      processId: null,
      rootUri: this.rootPath ? `file:///${this.rootPath.replace(/\\/g, '/')}` : null,
      capabilities: {
        textDocument: {
          hover: { dynamicRegistration: true, contentFormat: ['markdown', 'plaintext'] },
          completion: {
            dynamicRegistration: true,
            completionItem: { snippetSupport: true }
          },
          synchronization: {
            dynamicRegistration: true,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true
          }
        }
      }
    })
    this.notify('initialized', {})
    
  }

  // ── Monaco Integration ──────────────────────────────────────────

  openDocument(uri: string, text: string) {
    this.notify('textDocument/didOpen', {
      textDocument: {
        uri: uri,
        languageId: this.language,
        version: 1,
        text: text
      }
    })
  }

  updateDocument(uri: string, text: string, version: number) {
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }]
    })
  }

  async provideHover(model: any, position: any) {
    try {
      const result = await this.request('textDocument/hover', {
        textDocument: { uri: model.uri.toString() },
        position: { line: position.lineNumber - 1, character: position.column - 1 }
      })
      if (!result || !result.contents) return null

      // Convert LSP Hover to Monaco Hover
      const contents = Array.isArray(result.contents) ? result.contents : [result.contents]
      return {
        range: result.range ? this.toMonacoRange(result.range) : undefined,
        contents: contents.map((c: any) => ({
          value: typeof c === 'string' ? c : c.value
        }))
      }
    } catch {
      return null
    }
  }

  async provideCompletionItems(model: any, position: any) {
    try {
      const result = await this.request('textDocument/completion', {
        textDocument: { uri: model.uri.toString() },
        position: { line: position.lineNumber - 1, character: position.column - 1 }
      })
      if (!result) return { suggestions: [] }

      const items = Array.isArray(result) ? result : result.items
      const suggestions = items.map((item: any) => ({
        label: item.label,
        kind: this.toMonacoCompletionItemKind(item.kind),
        insertText: item.insertText || item.label,
        insertTextRules: item.insertTextFormat === 2 ? this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : 0,
        detail: item.detail,
        documentation: typeof item.documentation === 'string' ? item.documentation : item.documentation?.value
      }))
      return { suggestions }
    } catch {
      return { suggestions: [] }
    }
  }

  private publishDiagnostics(params: any) {
    const { uri, diagnostics } = params
    const model = this.monaco.editor.getModel(this.monaco.Uri.parse(uri))
    if (!model) return

    const markers = diagnostics.map((diag: any) => ({
      severity: this.toMonacoMarkerSeverity(diag.severity),
      startLineNumber: diag.range.start.line + 1,
      startColumn: diag.range.start.character + 1,
      endLineNumber: diag.range.end.line + 1,
      endColumn: diag.range.end.character + 1,
      message: diag.message,
      source: diag.source
    }))

    this.monaco.editor.setModelMarkers(model, this.language, markers)
  }

  // ── Mappers ─────────────────────────────────────────────────────

  private toMonacoRange(range: any) {
    return {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.character + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.character + 1
    }
  }

  private toMonacoCompletionItemKind(kind: number) {
    // Basic mapping from LSP CompletionItemKind to Monaco CompletionItemKind
    // See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#completionItemKind
    const kinds = this.monaco.languages.CompletionItemKind
    switch (kind) {
      case 1: return kinds.Text
      case 2: return kinds.Method
      case 3: return kinds.Function
      case 4: return kinds.Constructor
      case 5: return kinds.Field
      case 6: return kinds.Variable
      case 7: return kinds.Class
      case 8: return kinds.Interface
      case 9: return kinds.Module
      case 10: return kinds.Property
      case 11: return kinds.Unit
      case 12: return kinds.Value
      case 13: return kinds.Enum
      case 14: return kinds.Keyword
      case 15: return kinds.Snippet
      case 16: return kinds.Color
      case 17: return kinds.File
      case 18: return kinds.Reference
      case 19: return kinds.Folder
      case 20: return kinds.EnumMember
      case 21: return kinds.Constant
      case 22: return kinds.Struct
      case 23: return kinds.Event
      case 24: return kinds.Operator
      case 25: return kinds.TypeParameter
      default: return kinds.Text
    }
  }

  private toMonacoMarkerSeverity(severity: number) {
    switch (severity) {
      case 1: return this.monaco.MarkerSeverity.Error
      case 2: return this.monaco.MarkerSeverity.Warning
      case 3: return this.monaco.MarkerSeverity.Info
      case 4: return this.monaco.MarkerSeverity.Hint
      default: return this.monaco.MarkerSeverity.Info
    }
  }
}