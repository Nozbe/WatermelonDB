import isObj from './index'

describe('isObj', () => {
  it('checks for objects correctly', () => {
    expect(isObj({})).toBe(true)
    expect(isObj({ foo: 1, bar: 2 })).toBe(true)
    class A {}
    expect(isObj(new A())).toBe(true)
    expect(isObj([])).toBe(false)
    expect(isObj([{}, 1, 2])).toBe(false)
    expect(isObj(0)).toBe(false)
    expect(isObj(1)).toBe(false)
    expect(isObj(true)).toBe(false)
    expect(isObj(false)).toBe(false)
    expect(isObj(null)).toBe(false)
    expect(isObj(undefined)).toBe(false)
    expect(isObj('')).toBe(false)
    expect(isObj('hey')).toBe(false)
    expect(isObj(() => {})).toBe(false)
  })
})
