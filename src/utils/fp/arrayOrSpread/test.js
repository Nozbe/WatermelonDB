import logger from '../../common/logger'

import fromArrayOrSpread from '.'

const fn = (...args) => fromArrayOrSpread(args, 'fn', 'arg')

describe('fromArrayOrSpread', () => {
  it(`can return args from array or spread`, () => {
    expect(fn(1, 2, 3, 4)).toEqual([1, 2, 3, 4])
    expect(fn([1, 2, 3, 4])).toEqual([1, 2, 3, 4])
    expect(() => fn([], [])).toThrow()

    const spy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const manyArgs = Array(201).fill(1)
    expect(fn(...manyArgs)).toEqual(manyArgs)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
