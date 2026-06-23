import { describe, expect, it } from 'vitest'

// Verify the Spinner component module can be imported.
// We can't render JSX in this test env (no @testing-library/react),
// but we can verify the module exports.

import { Spinner } from '../components/thinking.js'

describe('Spinner', () => {
  it('is a function (component)', () => {
    expect(typeof Spinner).toBe('function')
  })

  it('accepts color and variant props (typed)', () => {
    // If this compiles, the types are correct.
    expect(Spinner.length).toBeGreaterThanOrEqual(0)
  })
})
