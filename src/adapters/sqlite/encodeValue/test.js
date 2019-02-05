import { logger } from '../../../utils/common'
import encodeValue from './index'

describe('SQLite encodeValue', () => {
  it('encodes SQLite values', () => {
    expect(encodeValue(true)).toBe('1')
    expect(encodeValue(false)).toBe('0')
    expect(encodeValue(null)).toBe('null')
    expect(encodeValue(10)).toBe('10')
    expect(encodeValue(3.14)).toBe('3.14')
    expect(encodeValue(`foo 'bar "baz" blah' hah`)).toBe(`'foo ''bar "baz" blah'' hah'`)
  })
  it('catches invalid values', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    expect(encodeValue(undefined)).toBe('null')
    expect(encodeValue(NaN)).toBe('null')
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})
