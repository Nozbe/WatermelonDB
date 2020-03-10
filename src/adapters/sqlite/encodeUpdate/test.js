import encodeUpdate from './index'

describe('SQLite encodeUpdate', () => {
  it('encodes model updates', () => {
    expect(
      encodeUpdate('tasks', {
        id: 'abcdef',
        project_id: '12345',
        flag1: true,
        flag2: false,
        optional_attribute: null,
      }),
    ).toEqual([
      `update "tasks" set "id"=?, "project_id"=?, "flag1"=?, "flag2"=?, "optional_attribute"=? where "id" is ?`,
      ['abcdef', '12345', true, false, null, 'abcdef'],
    ])
  })
})
