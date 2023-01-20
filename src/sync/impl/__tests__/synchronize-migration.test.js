import { mockDatabase, testSchema } from '../../../__tests__/testModels'
import { expectToRejectWithMessage } from '../../../__tests__/utils'
import { schemaMigrations, createTable, addColumns } from '../../../Schema/migrations'
import { emptyPull } from './helpers'

import { synchronize } from '../../index'
import { getLastPulledSchemaVersion, setLastPulledAt, setLastPulledSchemaVersion } from '../index'

describe('synchronize - migration syncs', () => {
  const testSchema10 = { ...testSchema, version: 10 }
  const migrations = schemaMigrations({
    migrations: [
      {
        toVersion: 10,
        steps: [
          addColumns({
            table: 'attachment_versions',
            columns: [{ name: 'reactions', type: 'string' }],
          }),
        ],
      },
      {
        toVersion: 9,
        steps: [
          createTable({
            name: 'attachments',
            columns: [{ name: 'parent_id', type: 'string', isIndexed: true }],
          }),
        ],
      },
      { toVersion: 8, steps: [] },
    ],
  })
  it(`remembers synced schema version on first sync`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })
    const pullChanges = jest.fn(emptyPull())

    await synchronize({
      database,
      pullChanges,
      pushChanges: jest.fn(),
      migrationsEnabledAtVersion: 7,
    })
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: null,
      schemaVersion: 10,
      migration: null,
    })
    expect(await getLastPulledSchemaVersion(database)).toBe(10)
    // check underlying database since it's an implicit API
    expect(await database.adapter.getLocal('__watermelon_last_pulled_schema_version')).toBe('10')
  })
  it(`remembers synced schema version on first sync, even if migrations are not enabled`, async () => {
    const { database } = mockDatabase({ schema: testSchema10 })
    const pullChanges = jest.fn(emptyPull())

    await synchronize({ database, pullChanges, pushChanges: jest.fn() })
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: null,
      schemaVersion: 10,
      migration: null,
    })
    expect(await getLastPulledSchemaVersion(database)).toBe(10)
  })
  it(`does not remember schema version if migration syncs are not enabled`, async () => {
    const { database } = mockDatabase({ schema: testSchema10 })
    await setLastPulledAt(database, 100)
    const pullChanges = jest.fn(emptyPull())

    await synchronize({ database, pullChanges, pushChanges: jest.fn() })
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: 100,
      schemaVersion: 10,
      migration: null,
    })
    expect(await getLastPulledSchemaVersion(database)).toBe(null)
  })
  it(`performs no migration if up to date`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })
    await setLastPulledAt(database, 1500)
    await setLastPulledSchemaVersion(database, 10)

    const pullChanges = jest.fn(emptyPull(2500))
    await synchronize({
      database,
      pullChanges,
      pushChanges: jest.fn(),
      migrationsEnabledAtVersion: 7,
    })
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: 1500,
      schemaVersion: 10,
      migration: null,
    })
    expect(await getLastPulledSchemaVersion(database)).toBe(10)
  })
  it(`performs migration sync on schema version bump`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })
    await setLastPulledAt(database, 1500)
    await setLastPulledSchemaVersion(database, 9)

    const pullChanges = jest.fn(emptyPull(2500))
    await synchronize({
      database,
      pullChanges,
      pushChanges: jest.fn(),
      migrationsEnabledAtVersion: 7,
    })
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: 1500,
      schemaVersion: 10,
      migration: {
        from: 9,
        tables: [],
        columns: [{ table: 'attachment_versions', columns: ['reactions'] }],
      },
    })
    expect(await getLastPulledSchemaVersion(database)).toBe(10)
  })
  it(`performs fallback migration sync`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })
    await setLastPulledAt(database, 1500)

    const pullChanges = jest.fn(emptyPull(2500))
    await synchronize({
      database,
      pullChanges,
      pushChanges: jest.fn(),
      migrationsEnabledAtVersion: 8,
    })
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: 1500,
      schemaVersion: 10,
      migration: {
        from: 8,
        tables: ['attachments'],
        columns: [{ table: 'attachment_versions', columns: ['reactions'] }],
      },
    })
    expect(await getLastPulledSchemaVersion(database)).toBe(10)
  })
  it(`does not remember schema version if pull fails`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })
    await synchronize({
      database,
      pullChanges: jest.fn(() => Promise.reject(new Error('pull-fail'))),
      pushChanges: jest.fn(),
      migrationsEnabledAtVersion: 8,
    }).catch((e) => e)
    expect(await getLastPulledSchemaVersion(database)).toBe(null)
  })
  it(`fails on programmer errors`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })

    await expectToRejectWithMessage(
      synchronize({ database, migrationsEnabledAtVersion: '9' }),
      'Invalid migrationsEnabledAtVersion',
    )
    await expectToRejectWithMessage(
      synchronize({ database, migrationsEnabledAtVersion: 11 }),
      'migrationsEnabledAtVersion must not be greater than current schema version',
    )
    await expectToRejectWithMessage(
      synchronize({
        database: mockDatabase({ schema: testSchema10 }).db,
        migrationsEnabledAtVersion: 9,
      }),
      'Migration syncs cannot be enabled on a database that does not support migrations',
    )
    await expectToRejectWithMessage(
      synchronize({ database, migrationsEnabledAtVersion: 6 }),
      `migrationsEnabledAtVersion is too low - not possible to migrate from schema version 6`,
    )
  })
  it(`fails on last synced schema version > current schema version`, async () => {
    const { database } = mockDatabase({ schema: testSchema10, migrations })
    await setLastPulledAt(database, 1500)
    await setLastPulledSchemaVersion(database, 11)
    await expectToRejectWithMessage(
      synchronize({ database, migrationsEnabledAtVersion: 10 }),
      /Last synced schema version \(11\) is greater than current schema version \(10\)/,
    )
  })
})
