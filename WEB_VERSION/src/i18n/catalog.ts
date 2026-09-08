import { en } from './en'
import { ja } from './ja'
import { khm } from './khm'
import type { Locale, Translations } from './types'
import { zh } from './zh'
import { zhHant } from './zh-hant'

export const TRANSLATIONS: Record<Locale, Translations> = {
  en,
  khm,
  zh,
  'zh-hant': zhHant,
  ja
}
