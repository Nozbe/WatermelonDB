import withoutIdentical from './index'

describe('watermelondb/utils/fp/withoutIdentical', () => {
  it('removes stuff from the array', () => {
    expect(withoutIdentical(['a'], ['a', 'b', 'c'])).toEqual(['b', 'c'])
    expect(withoutIdentical(['a', 'c', 'z'], ['a', 'b', 'c'])).toEqual(['b'])
    expect(withoutIdentical([1, 2, 6], [0, 1, 2, 3])).toEqual([0, 3])
    const a1 = {}
    const a2 = {}
    const a3 = {}
    const a9 = {}
    expect(withoutIdentical([a1, a2, a9], [a1, a2, a3])).toEqual([a3])

    // === semantics
    expect(withoutIdentical([{ foo: 'bar' }], [{ foo: 'bar' }])).toEqual([{ foo: 'bar' }])
  })
})
