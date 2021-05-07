import checkName from './index'

describe('checkName', () => {
  it('returns safe names as-is', () => {
    expect(checkName('tasks')).toBe('tasks')
    expect(checkName('tag_assignments')).toBe('tag_assignments')
    expect(checkName('a')).toBe('a')
  })
  it(`keeps returning a safe name as is`, () => {
    expect(checkName('tasks')).toBe('tasks')
    expect(checkName('tasks')).toBe('tasks')
  })
  it('does not allow unsafe names', () => {
    const unsafeNames = [
      '"hey"',
      '\'hey\'',
      '`hey`',
      'hey)',
      'hey --',
      'foo\' and delete * from users --',
      '$loki',
      '__foo',
      '__proto__',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
      'toString',
      'toLocaleString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'constructor',
      'prototype',
      'rowid',
      'oid',
      '_rowid_',
      'ROWID',
      '_ROWID_',
      '0foo',
      'fó',
      'cześć',
      'русском',
      'foo_русском',
      '❤️',
      'hey\nhey',
      'whatsup\n',
      '\nwhatsup',
      'sqlite_master',
      'sqlite_stat',
      'sqlite_stat1',
      'sqlite_stat3',
      0,
      undefined,
      null,
      [],
      {},
      NaN,
    ]
    unsafeNames.forEach(name => {
      // console.log(name)
      expect(() => checkName(name)).toThrow('Unsafe name')
    })
  })
})
