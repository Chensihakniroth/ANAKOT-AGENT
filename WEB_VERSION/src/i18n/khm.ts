// Khmer (khm) translations for the web app.
//
// Skeleton: a small set of high-visibility strings is translated to Khmer so
// the language picker shows real Khmer text. All other keys fall back to the
// English baseline via `defineLocale()` (see define-locale.ts) — missing
// keys are inherited from `en` rather than left as empty strings or raw
// key paths.
//
// Add new Khmer strings here as translations become available.

import { defineLocale } from './define-locale'

export const khm = defineLocale({
  common: {
    apply: 'អនុវត្ត',
    back: 'ថយក្រោយ',
    save: 'រក្សាទុក',
    saving: 'កំពុងរក្សាទុក…',
    cancel: 'បោះបង់',
    change: 'ផ្លាស់ប្តូរ',
    choose: 'ជ្រើសរើស',
    clear: 'សម្អាត',
    close: 'បិទ',
    collapse: 'បង្រួម',
    confirm: 'បញ្ជាក់',
    connect: 'ភ្ជាប់',
    connecting: 'កំពុងភ្ជាប់',
    continue: 'បន្ត',
    copied: 'បានចម្លង',
    copy: 'ចម្លង',
    copyFailed: 'ការចម្លងបានបរាជ័យ',
    delete: 'លុប',
    docs: 'ឯកសារ',
    done: 'រួចរាល់',
    error: 'កំហុស',
    failed: 'បានបរាជ័យ',
    free: 'ឥតគិតថ្លៃ',
    loading: 'កំពុងផ្ទុក…',
    notSet: 'មិនបានកំណត់',
    refresh: 'ផ្ទុកឡើងវិញ',
    remove: 'យកចេញ',
    replace: 'ជំនួស',
    retry: 'ព្យាយាមម្តងទៀត',
    run: 'ដំណើរការ',
    send: 'ផ្ញើ',
    set: 'កំណត់',
    skip: 'រំលង',
    update: 'ធ្វើបច្ុប្បន្នភាព',
    on: 'បើក',
    off: 'បិទ'
  },

  language: {
    label: 'ភាសា',
    description: 'ជ្រើសរើសភាសាសម្រាប់ចំណុចប្រទាក់។',
    saving: 'កំពុងរក្សាទុកភាសា…',
    saveError: 'មិនអាចរក្សាទុកភាសាបានទេ។',
    switchTo: 'ប្តូរទៅភាសា{khm}',
    searchPlaceholder: 'ស្វែងរកភាសា…',
    noResults: 'រកមិនឃើញភាសាដែលត្រូវគ្នាទេ।'
  }
})