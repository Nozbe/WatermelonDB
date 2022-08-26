import areRecordsEqual from './index'

describe('areRecordsEqual', () => {
  it(`works correctly`, () => {
    expect(areRecordsEqual({}, {})).toBe(true)
    expect(areRecordsEqual({ a: 3.14, b: 'b', c: true }, { a: 3.14, b: 'b', c: true })).toBe(true)
    expect(areRecordsEqual({ a: 3.14, b: 'b' }, { a: 3.14, b: 'c' })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: 'b' }, { a: 3.14 })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: false }, { a: 3.14 })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: null }, { a: 3.14 })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: undefined }, { a: 3.14 })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: undefined }, { a: 3.14, b: null })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: 0 }, { a: 3.14, b: '0' })).toBe(false)
    expect(areRecordsEqual({ a: 3.14, b: 0 }, { a: 3.14, b: false })).toBe(false)
  })
})
