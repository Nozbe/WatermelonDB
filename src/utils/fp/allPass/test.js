import allPass from './index'

describe('allPass', () => {
  it(`works correctly`, () => {
    const isFoo = (x) => x.foo
    const isBar = (x) => x.bar
    expect(allPass([isFoo])({ foo: true })).toBe(true)
    expect(allPass([isFoo])({ foo: true, bar: true })).toBe(true)
    expect(allPass([isFoo])({ bar: true })).toBe(false)

    expect(allPass([isBar])({ bar: true })).toBe(true)
    expect(allPass([isBar])({ bar: true, foo: true })).toBe(true)
    expect(allPass([isBar])({ foo: true })).toBe(false)

    expect(allPass([isFoo, isBar])({})).toBe(false)
    expect(allPass([isFoo, isBar])({ foo: true })).toBe(false)
    expect(allPass([isFoo, isBar])({ bar: true })).toBe(false)
    expect(allPass([isFoo, isBar])({ foo: true, bar: true })).toBe(true)

    expect(allPass([])({})).toBe(true)
  })
})
