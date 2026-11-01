import { testSchema } from '../../__tests__/helpers'
import DatabaseAdapterCompat from '../../compat'
import { schemaMigrations, addColumns } from '../../../Schema/migrations'

// NOTE: The JSI dispatcher is the native (React Native) variant of makeDispatcher. These tests drive
// it with a fake `global.nativeWatermelonCreateAdapter` to check that errors coming out of the C++
// side (thrown on iOS, returned on Android - see DatabaseBridge.cpp / JSIHelpers.h) end up as
// rejected promises rather than uncaught exceptions
jest.mock(
  'react-native',
  () => ({ NativeModules: { WMDatabaseBridge: {} }, Platform: { OS: 'android' } }),
  { virtual: true },
)
jest.mock('./index', () => require('./index.native'))

// eslint-disable-next-line import/first
import SQLiteAdapter from '../index'

const openError = new Error('Error while trying to open database - unable to open database file')
const setUpError = new Error('Failed to set up the database correctly - table "tasks" already exists')
const resetError = new Error('Failed to reset database correctly - disk I/O error')

const makeAdapter = (options = {}) => {
  const onSetUpError = jest.fn()
  const adapter = new SQLiteAdapter({
    dbName: 'test',
    schema: testSchema,
    jsi: true,
    onSetUpError,
    ...options,
  })
  expect(adapter._dispatcherType).toBe('jsi')
  return { adapter, compat: new DatabaseAdapterCompat(adapter), onSetUpError }
}

describe('SqliteJsiDispatcher', () => {
  afterEach(() => {
    delete global.nativeWatermelonCreateAdapter
  })

  describe.each([
    ['throws (iOS)', (error) => () => { throw error }],
    ['returns an Error (Android)', (error) => () => error],
  ])('when native %s', (_name, failingWith) => {
    it('rejects setup and calls onSetUpError when the database cannot be opened', async () => {
      global.nativeWatermelonCreateAdapter = jest.fn(failingWith(openError))

      const { adapter, compat, onSetUpError } = makeAdapter()
      await expect(adapter.initializingPromise).rejects.toBe(openError)
      expect(onSetUpError).toHaveBeenCalledWith(openError)

      // there is no database to work with, so later calls are rejected too instead of throwing
      await expect(compat.unsafeResetDatabase()).rejects.toBe(openError)
      await expect(compat.getLocal('foo')).rejects.toBe(openError)
    })
    it('rejects setup and calls onSetUpError when setting up the schema fails', async () => {
      const db = {
        initialize: jest.fn(() => ({ code: 'schema_needed' })),
        setUpWithSchema: jest.fn(failingWith(setUpError)),
      }
      global.nativeWatermelonCreateAdapter = jest.fn(() => db)

      const { adapter, onSetUpError } = makeAdapter()
      await expect(adapter.initializingPromise).rejects.toBe(setUpError)
      expect(onSetUpError).toHaveBeenCalledWith(setUpError)
      expect(db.setUpWithSchema).toHaveBeenCalledTimes(1)
    })
    it('rejects setup and calls onSetUpError when a migration fails', async () => {
      const db = {
        initialize: jest.fn(() => ({ code: 'migrations_needed', databaseVersion: 1 })),
        setUpWithMigrations: jest.fn(failingWith(setUpError)),
      }
      global.nativeWatermelonCreateAdapter = jest.fn(() => db)

      const onError = jest.fn()
      const { adapter, onSetUpError } = makeAdapter({
        schema: { ...testSchema, version: 2 },
        migrations: schemaMigrations({
          migrations: [
            {
              toVersion: 2,
              steps: [addColumns({ table: 'tasks', columns: [{ name: 'foo', type: 'string' }] })],
            },
          ],
        }),
        migrationEvents: { onStart: jest.fn(), onSuccess: jest.fn(), onError },
      })
      await expect(adapter.initializingPromise).rejects.toBe(setUpError)
      expect(onSetUpError).toHaveBeenCalledWith(setUpError)
      expect(onError).toHaveBeenCalledWith(setUpError)
    })
    it('rejects unsafeResetDatabase and lets it be retried', async () => {
      const db = {
        initialize: jest.fn(() => ({ code: 'ok' })),
        unsafeResetDatabase: jest.fn(failingWith(resetError)),
        getLocal: jest.fn(() => null),
      }
      global.nativeWatermelonCreateAdapter = jest.fn(() => db)

      const { adapter, compat, onSetUpError } = makeAdapter()
      await adapter.initializingPromise
      expect(onSetUpError).not.toHaveBeenCalled()

      await expect(compat.unsafeResetDatabase()).rejects.toBe(resetError)

      // the database stays usable - e.g. to retry the reset
      db.unsafeResetDatabase.mockImplementation(() => undefined)
      await expect(compat.unsafeResetDatabase()).resolves.toBeUndefined()
      expect(db.unsafeResetDatabase).toHaveBeenCalledTimes(2)
      expect(await compat.getLocal('foo')).toBe(null)
    })
  })

  it('rejects calls made with the wrong number of arguments', async () => {
    // JSIHelpers.h returns an Error (Android) / throws (iOS) when a host function is called with the
    // wrong number of arguments - either way the call must be rejected, not crash
    const db = {
      initialize: jest.fn(() => ({ code: 'ok' })),
      getLocal: jest.fn((...args) =>
        args.length === 1 ? 'value' : new Error(`getLocal takes 1 arguments`),
      ),
    }
    global.nativeWatermelonCreateAdapter = jest.fn(() => db)

    const { adapter, compat } = makeAdapter()
    await adapter.initializingPromise
    expect(await compat.getLocal('foo')).toBe('value')
    await expect(
      new Promise((resolve, reject) =>
        adapter._dispatcher.call('getLocal', ['foo', 'extra'], (result) =>
          result.error ? reject(result.error) : resolve(result.value),
        ),
      ),
    ).rejects.toThrow('getLocal takes 1 arguments')
  })
})
