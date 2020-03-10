import encodeInsert from './index'

describe('SQLite encodeInsert', () => {
  it('encodes model inserts', () => {
    expect(
      encodeInsert('tasks', {
        id: 'abcdef',
        project_id: '12345',
        flag1: true,
        flag2: false,
        optional_attribute: null,
      }),
    ).toEqual([
      `insert into tasks ("id", "project_id", "flag1", "flag2", "optional_attribute") values (?, ?, ?, ?, ?)`,
      ['abcdef', '12345', true, false, null],
    ])
  })
})
