import isObject from './index'

describe('watermelondb/utils/fp/isObject', () => {
  it('checks for objects correctly', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ foo: 1, bar: 2 })).toBe(true)
    class A {}
    expect(isObject(new A())).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject([{}, 1, 2])).toBe(false)
    expect(isObject(0)).toBe(false)
    expect(isObject(1)).toBe(false)
    expect(isObject(true)).toBe(false)
    expect(isObject(false)).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject('')).toBe(false)
    expect(isObject('hey')).toBe(false)
    expect(isObject(() => {})).toBe(false)
  })
})
