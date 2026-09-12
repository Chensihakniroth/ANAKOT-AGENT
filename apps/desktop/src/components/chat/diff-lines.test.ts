import { describe, expect, it } from 'vitest'

import { parseDiff, stripDiffFileHeaders, type DiffLine } from '@/components/chat/diff-lines'

const SAMPLE_DIFF = `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,7 +10,7 @@ import { foo } from './foo'
 import { bar } from './bar'
 import { baz } from './baz'

-function oldFunction() {
-  console.log('old behavior')
-  return false
+function newFunction() {
+  console.log('new behavior')
+  return true
 }

@@ -42,3 +42,5 @@ function keepThis() {
   const x = 1
   const y = 2
   return x + y
+}
+
+// brand new line at end`

describe('stripDiffFileHeaders', () => {
  it('removes diff --git header', () => {
    const result = stripDiffFileHeaders(SAMPLE_DIFF)
    expect(result).not.toContain('diff --git')
  })

  it('removes index line', () => {
    const result = stripDiffFileHeaders(SAMPLE_DIFF)
    expect(result).not.toContain('index ')
  })

  it('removes --- a/ and +++ b/ lines', () => {
    const result = stripDiffFileHeaders(SAMPLE_DIFF)
    expect(result).not.toContain('--- a/')
    expect(result).not.toContain('+++ b/')
  })

  it('keeps the @@ hunk headers', () => {
    const result = stripDiffFileHeaders(SAMPLE_DIFF)
    expect(result).toContain('@@')
  })

  it('keeps the actual diff content', () => {
    const result = stripDiffFileHeaders(SAMPLE_DIFF)
    expect(result).toContain('function oldFunction')
    expect(result).toContain('function newFunction')
  })
})

describe('parseDiff', () => {
  it('returns an array of DiffLine objects', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]).toHaveProperty('kind')
    expect(lines[0]).toHaveProperty('text')
  })

  it('correctly classifies additions', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const adds = lines.filter(l => l.kind === 'add')
    expect(adds.length).toBe(6)
    expect(adds.some(l => l.text.includes('newFunction'))).toBe(true)
  })

  it('correctly classifies removals', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const removes = lines.filter(l => l.kind === 'remove')
    expect(removes.length).toBe(3)
    expect(removes.some(l => l.text.includes('old behavior'))).toBe(true)
  })

  it('tracks new-file line numbers', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const withNewNo = lines.filter(l => l.newNo !== undefined)
    expect(withNewNo.length).toBeGreaterThan(0)
    // Line numbers should be ascending
    const nums = withNewNo.map(l => l.newNo!)
    const sorted = [...nums].sort((a, b) => a - b)
    expect(nums).toEqual(sorted)
  })

  it('tracks old-file line numbers', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const withOldNo = lines.filter(l => l.oldNo !== undefined)
    expect(withOldNo.length).toBeGreaterThan(0)
  })

  it('strips +/-/space markers from text', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    for (const line of lines) {
      expect(line.text.startsWith('+')).toBe(false)
      expect(line.text.startsWith('-')).toBe(false)
    }
  })

  it('drops @@ hunk headers from output', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const hunkHeaders = lines.filter(l => l.text.startsWith('@@'))
    expect(hunkHeaders.length).toBe(0)
  })

  it('inserts blank separator between hunks', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const blanks = lines.filter(l => l.kind === 'context' && l.text === '')
    expect(blanks.length).toBeGreaterThan(0)
  })

  it('handles diffs without headers (bare hunks)', () => {
    const bare = `@@ -1,3 +1,3 @@
 context line
-old line
+new line
 another context`
    const lines = parseDiff(bare)
    expect(lines.filter(l => l.kind === 'add').length).toBe(1)
    expect(lines.filter(l => l.kind === 'remove').length).toBe(1)
  })

  it('handles empty / non-hunk input gracefully', () => {
    const lines = parseDiff('not a diff at all')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every(l => l.kind === 'context')).toBe(true)
  })
})

describe('DiffLine types', () => {
  it('marks additions with newNo only', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const add = lines.find(l => l.kind === 'add' && l.text.includes('new behavior'))
    expect(add).toBeDefined()
    expect(add!.newNo).toBeDefined()
  })

  it('removals with oldNo only', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const remove = lines.find(l => l.kind === 'remove' && l.text.includes('old behavior'))
    expect(remove).toBeDefined()
    expect(remove!.oldNo).toBeDefined()
  })

  it('context lines have both oldNo and newNo', () => {
    const lines = parseDiff(SAMPLE_DIFF)
    const context = lines.find(l => l.kind === 'context' && l.text.includes('import'))
    expect(context).toBeDefined()
    expect(context!.oldNo).toBeDefined()
    expect(context!.newNo).toBeDefined()
  })
})
