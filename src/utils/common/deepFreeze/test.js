import deepFreeze from './index'

describe('deepFreeze', () => {
  it('can deep freeze an object', () => {
    const obj = { foo: { bar: [], baz: { blah: 1 } } }
    const second = deepFreeze(obj)
    expect(second).toBe(obj)
    expect(obj.foo.baz.blah).toBe(1)
    expect(() => {
      obj.foo = {}
    }).toThrow()
    expect(() => {
      obj.foo.bar.push(1)
    }).toThrow()
    expect(() => {
      obj.foo.baz.blah = 2
    }).toThrow()
    expect(obj.foo.baz.blah).toBe(1)
    expect(obj.foo.bar.length).toBe(0)
  })
})
