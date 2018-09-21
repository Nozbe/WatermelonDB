import encodeName from './index'

describe('watermelondb/adapters/sqlite/encodeName', () => {
  it('encodes names', () => {
    expect(encodeName(`from`)).toBe(`"from"`)
    expect(encodeName(`tasks`)).toBe(`"tasks"`)
  })
})
