import { describe, expect, it } from 'vitest'

import { withAlpha } from './color'

describe('withAlpha', () => {
  it('turns a hex token into rgba at the given opacity', () => {
    expect(withAlpha('#5B3DF5', 0.2)).toBe('rgba(91,61,245,0.2)')
    expect(withAlpha('#FFFFFF', 0.24)).toBe('rgba(255,255,255,0.24)')
    expect(withAlpha('#121218', 0.1)).toBe('rgba(18,18,24,0.1)')
  })
})
