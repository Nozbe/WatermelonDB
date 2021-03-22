import sortBy from './index'

describe('sortBy', () => {
  it(`works correctly`, () => {
    const a = { name: 'andrew', age: 24 }
    const b = { name: 'bartholomeus', age: 69 }
    const c = { name: 'cecil', age: 15 }
    expect(sortBy(x => x.name, [a, b, c])).toEqual([a, b, c])
    expect(sortBy(x => x.name, [c, a, b])).toEqual([a, b, c])
    expect(sortBy(x => x.age, [a, b, c])).toEqual([c, a, b])
    expect(sortBy(x => x.age, [b, a, c])).toEqual([c, a, b])
    expect(sortBy(x => -x.age, [a, b, c])).toEqual([b, a, c])
  })
  it(`does not mutate`, () => {
    const arr = [123, 4, 23]
    sortBy(x => x, arr)
    expect(arr).toEqual([123, 4, 23])
  })
})
