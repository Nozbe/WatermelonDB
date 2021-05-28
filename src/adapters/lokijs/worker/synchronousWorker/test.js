import { shallowCloneDeepObjects } from './index'

describe('shallowCloneDeepObjects', () => {
  it('shallow clones deep objects', () => {
    const obj = { foo: 'bar' }
    const deep = ['foo', ['bar', [obj]]]
    const cloned = shallowCloneDeepObjects(deep)
    expect(cloned).toEqual(deep)
    expect(cloned).not.toBe(deep)
    expect(cloned[1][1][0]).toEqual(obj)
    expect(cloned[1][1][0]).not.toBe(obj)
    obj.bar = 'baz'
    expect(cloned[1][1][0]).toEqual({ foo: 'bar' })
  })
})
