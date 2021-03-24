import keys from './index'

describe('keys', () => {
  it(`works correctly`, () => {
    expect(keys({ foo: '1', bar: 2, baz: null })).toEqual(['foo', 'bar', 'baz'])
    expect(keys({})).toEqual([])
  })
})
