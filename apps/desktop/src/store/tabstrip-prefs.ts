// Tabstrip prefs — app-wide default for zones that have made no choice of their own.
// Mirrors VS Code's workbench.editor.showTabs.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.tabStripDefault'

export type TabStripDefault = 'auto' | 'always' | 'never'

function readTabStripDefault(): TabStripDefault {
  const raw = storedString(STORAGE_KEY)
  return raw === 'always' || raw === 'never' ? raw : 'auto'
}

export const $tabStripDefault = atom<TabStripDefault>(readTabStripDefault())
$tabStripDefault.subscribe(v => persistString(STORAGE_KEY, v === 'auto' ? '' : v))

export function setTabStripDefault(value: TabStripDefault): void { $tabStripDefault.set(value) }
