import SyncLogger from './index'

describe('SyncLogger', () => {
  it('allows to make and read logs', () => {
    const logger = new SyncLogger()
    const log1 = logger.newLog()
    log1.a = 'a'
    log1.b = 'b'

    const log2 = logger.newLog()
    log2.c = 'c'

    const expectedLogs = [{ a: 'a', b: 'b' }, { c: 'c' }]
    expect(logger.logs).toEqual(expectedLogs)
    expect(logger.logs).toEqual(expectedLogs)
  })
  it('censors logs properly', () => {
    const logger = new SyncLogger()
    const log1 = logger.newLog()
    log1.startedAt = new Date()
    log1.resolvedConflicts = [
      {
        local: { int: 10, id: 'id1', name: 'Hello' },
        remote: { name: '', proj_id: 'proj' },
        resolved: { name: 'LongName', some: null },
      },
      {
        local: { name: 'Foo' },
        remote: { name: '', name2: 'N' },
      },
    ]

    const log2 = logger.newLog()
    log2.resolvedConflicts = [
      { local: { field: 'Censor' }, resolved: { field: 'Censor', id: 'id2', other_id: null } },
    ]

    expect(logger.logs).toEqual([
      {
        startedAt: log1.startedAt,
        resolvedConflicts: [
          {
            local: { int: 10, id: 'id1', name: 'He***lo(5)' },
            remote: { name: '***(0)', proj_id: 'proj' },
            resolved: { name: 'Lo***me(8)', some: null },
          },
          {
            local: { name: 'Fo***oo(3)' },
            remote: { name: '***(0)', name2: 'N***N(1)' },
          },
        ],
      },
      {
        resolvedConflicts: [
          {
            local: { field: 'Ce***or(6)' },
            resolved: { field: 'Ce***or(6)', id: 'id2', other_id: null },
          },
        ],
      },
    ])
  })
  it(`returns formatted logs`, () => {
    const logger = new SyncLogger()
    const log1 = logger.newLog()
    log1.a = 'a'
    expect(logger.formattedLogs).toEqual(`[\n  {\n    "a": "a"\n  }\n]`)
  })
  it(`Respects the log limit`, () => {
    const logger = new SyncLogger(2)
    const log1 = logger.newLog()
    const log2 = logger.newLog()
    expect(logger.logs).toEqual([log1, log2])
    const log3 = logger.newLog()
    expect(logger.logs).toEqual([log2, log3])
  })
})
