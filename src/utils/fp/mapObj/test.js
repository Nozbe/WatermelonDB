import mapObj from './index'

describe('mapObj', () => {
  it(`works correctly`, () => {
    const obj = {
      a: 5,
      b: 10,
      c: 20,
    }
    expect(mapObj((x) => x + 1, obj)).toEqual({ a: 6, b: 11, c: 21 })
    expect(mapObj((x) => x + 1)(obj)).toEqual({ a: 6, b: 11, c: 21 })
    expect(mapObj((x) => x + 1, {})).toEqual({})
    // TODO: Should we test for __proto__ ?
  })
})
