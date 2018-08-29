import ensureSync from '.'

describe('watermelondb/utils/common/ensureSync', () => {
  it('passes values through', () => {
    expect(ensureSync('hello')).toBe('hello')
    expect(ensureSync(true)).toBe(true)
    expect(ensureSync(null)).toBe(null)
    expect(ensureSync(undefined)).toBe(undefined)
  })
  it('throws an error if Promise is returned', () => {
    expect(() => ensureSync(Promise.resolve('hello'))).toThrow()
    const asyncFunc = async () => 'blah'
    expect(() => ensureSync(asyncFunc())).toThrow()
  })
})
