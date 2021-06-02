import decodeQueryResult from './index'

describe('decodeQueryResult', () => {
  it(`decodes query result`, () => {
    expect(decodeQueryResult([])).toEqual([])
    expect(decodeQueryResult([['a', 'b', 'c']])).toEqual([])
    expect(
      decodeQueryResult([
        ['a', 'b', 'c'],
        [1, 2, 3],
      ]),
    ).toEqual([{ a: 1, b: 2, c: 3 }])
    expect(decodeQueryResult([['a', 'b', 'c'], 'foo'])).toEqual(['foo'])
    expect(decodeQueryResult([['a', 'b', 'c'], 'foo', [1, 2, 3], 'bar', [10, 20, 30]])).toEqual([
      'foo',
      { a: 1, b: 2, c: 3 },
      'bar',
      { a: 10, b: 20, c: 30 },
    ])
  })
})
