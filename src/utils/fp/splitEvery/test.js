import splitEvery from './index'

describe('splitEvery', () => {
  it(`works correctly`, () => {
    const long = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
    const short = [1, 2, 3]
    const empty = []

    expect(splitEvery(10, long)).toEqual([long])
    expect(splitEvery(3, long)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [0]])
    expect(splitEvery(4, short)).toEqual([short])
    expect(splitEvery(3, short)).toEqual([short])
    expect(splitEvery(2, short)).toEqual([[1, 2], [3]])
    expect(splitEvery(1, short)).toEqual([[1], [2], [3]])
    expect(splitEvery(1, empty)).toEqual([])
  })
})
