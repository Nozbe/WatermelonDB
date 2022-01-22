import filterObj from './index'

describe('filterObj', () => {
  it(`works correctly`, () => {
    const obj = {
      c: 20,
      a: 5,
      b: 10,
    }
    expect(filterObj((x) => x > 9, obj)).toEqual({ c: 20, b: 10 })
    expect(filterObj((x) => x < 11)(obj)).toEqual({ a: 5, b: 10 })
    expect(filterObj((x) => x < 0)(obj)).toEqual({})
    expect(filterObj((x) => x < 11, {})).toEqual({})
    // TODO: Should we test for __proto__ ?
  })
})
