import type { ResultCallback } from '../../utils/fp/Result'
import type { AppSchema } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'
import { $Exact } from '../../types'

export type SQL = string
export type SQLiteArg = string | boolean | number | null
export type SQLiteQuery = [SQL, SQLiteArg[]]

export type MigrationEvents = {
  onSuccess: () => void,
  onStart: () => void,
  onError: (error: Error) => void,
}

export type SQLiteAdapterOptions = $Exact<{
  dbName?: string,
  schema: AppSchema,
  migrations?: SchemaMigrations,
  // The new way to run the database in synchronous mode.
  jsi?: boolean,
  migrationEvents?: MigrationEvents,
  // Called when database failed to set up (initialize) correctly. It's possible that
  // it's some transient error that will be solved by a reload, but it's
  // very likely that the error is persistent (e.g. a corrupted database).
  // Pass a callback to offer to the user to reload the app or log out
  onSetUpError?: (error: Error) => void,
  // Sets exclusive file locking mode in sqlite. Use this ONLY if you need to - e.g. seems to fix
  // mysterious "database is malformed" issues on JSI+Android when using Headless JS
  usesExclusiveLocking?: boolean,
}>

export type DispatcherType = 'asynchronous' | 'jsi'

export type SqliteDispatcherMethod =
  | 'initialize'
  | 'setUpWithSchema'
  | 'setUpWithMigrations'
  | 'find'
  | 'query'
  | 'queryIds'
  | 'unsafeQueryRaw'
  | 'count'
  | 'batch'
  | 'unsafeLoadFromSync'
  | 'provideSyncJson'
  | 'unsafeResetDatabase'
  | 'getLocal'
  | 'unsafeExecuteMultiple'

export interface SqliteDispatcher {
  call(methodName: SqliteDispatcherMethod, args: any[], callback: ResultCallback<any>): void;
}
