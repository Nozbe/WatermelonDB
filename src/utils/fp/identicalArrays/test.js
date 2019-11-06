import identicalArrays from './index'

describe('identicalArrays', () => {
  it('checks if arrays have identical contents', () => {
    expect(identicalArrays([], [])).toBe(true)
    expect(identicalArrays([1], [1])).toBe(true)
    expect(identicalArrays([true], [true])).toBe(true)
    expect(identicalArrays(['foo'], ['foo'])).toBe(true)
    // false
    expect(identicalArrays(['foo', 'bar'], ['foo'])).toBe(false)
    expect(identicalArrays(['foo'], ['foo', 'bar'])).toBe(false)
    expect(identicalArrays(['foo'], ['bar'])).toBe(false)
    expect(identicalArrays([1], [true])).toBe(false)
  })
})
