import anyPass from './index'

describe('anyPass', () => {
  it(`works correctly`, () => {
    const isFoo = x => x.foo
    const isBar = x => x.bar
    expect(anyPass([isFoo])({ foo: true })).toBe(true)
    expect(anyPass([isFoo])({ bar: true })).toBe(false)

    expect(anyPass([isBar])({ bar: true })).toBe(true)
    expect(anyPass([isBar])({ foo: true })).toBe(false)

    expect(anyPass([isFoo, isBar])({ })).toBe(false)
    expect(anyPass([isFoo, isBar])({ foo: true })).toBe(true)
    expect(anyPass([isFoo, isBar])({ bar: true })).toBe(true)
    expect(anyPass([isFoo, isBar])({ foo: true, bar: true })).toBe(true)

    expect(anyPass([])({})).toBe(false)
  })
})
