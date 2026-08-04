/**
 * Monaco local bundling — kills the runtime CDN fetch.
 *
 * `@monaco-editor/react` defaults to loading Monaco from jsdelivr via its
 * AMD loader (`loader.js`). In the packaged desktop app (anakot-app:// custom
 * protocol, possibly offline) that script fetch fails with a generic
 * `[object Event]` load error and the editor never initialises.
 *
 * Fix: import the already-installed `monaco-editor` package directly and hand
 * it to the loader, plus register the web workers so nothing is fetched over
 * the network at runtime.
 */
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  },
}

// Use the bundled copy instead of the CDN. Must run before any editor mounts.
loader.config({ monaco })
