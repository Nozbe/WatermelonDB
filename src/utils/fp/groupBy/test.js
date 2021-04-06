import groupBy from './index'

describe('groupBy', () => {
  it(`works correctly`, () => {
    const xs = [
      { name: 'A', score: 1 },
      { name: 'B', score: 2 },
      { name: 'C', score: 1 },
      { name: 'D', score: 2 },
    ]
    const [a, b, c, d] = xs
    expect(groupBy(x => x.score)(xs)).toEqual({ 1: [a, c], 2: [b, d] })
    expect(groupBy(x => x.name)(xs)).toEqual({ A: [a], B: [b], C: [c], D: [d] })
    expect(groupBy(x => x.name)([])).toEqual({ })
  })
})
