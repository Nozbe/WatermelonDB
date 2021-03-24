import pipe from './index'

describe('pipe', () => {
  it(`works correctly`, () => {
    const add = (a, b) => a + b
    const plus10 = a => a + 10
    const times5 = a => a * 5

    expect(pipe()()).toBe(undefined)
    expect(pipe()(1, 2)).toBe(undefined)
    expect(pipe(add)(1, 2)).toBe(3)
    expect(pipe(add, plus10)(1, 2)).toBe(13)
    expect(pipe(add, times5, x => x - 5, plus10)(3, 4)).toBe(40)
  })
})
