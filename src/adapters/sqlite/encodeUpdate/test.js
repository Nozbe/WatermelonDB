import encodeUpdate from '.'

describe('watermelondb/adapters/sqlite/encodeUpdate', () => {
  it('encodes model updates', () => {
    const mockModel = {
      table: 'tasks',
      _raw: {
        id: 'abcdef',
        project_id: '12345',
        flag1: true,
        flag2: false,
        optional_attribute: null,
      },
    }
    expect(encodeUpdate(mockModel)).toEqual([
      `update tasks set id=?, project_id=?, flag1=?, flag2=?, optional_attribute=? where id is ?`,
      ['abcdef', '12345', true, false, null, 'abcdef'],
    ])
  })
})
