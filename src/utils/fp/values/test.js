import values from './index'

describe('values', () => {
  it(`works correctly`, () => {
    expect(values({ foo: '1', bar: 2, baz: null })).toEqual(['1', 2, null])
    expect(values({})).toEqual([])
  })
})
