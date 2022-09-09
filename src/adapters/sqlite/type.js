// @flow

import { type ResultCallback } from '../../utils/fp/Result'

import type { AppSchema, TableName, SchemaVersion } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'

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

// This is the internal format of batch operations
// It's ugly, but optimized for performance and versatility, e.g.:
// adding a record:  [1, 'table', 'insert into...', [['id', 'created', ...]]]
// updating a record [0, null, 'update...', [['id', 'created', ...]]]
// removing a record [-1, table, 'delete...', [['id', 'created', ...]]]
type NativeBridgeBatchOperationCacheBehavior =
  | -1 // remove from cache
  | 0 // ignore
  | 1 // add to cache
export type NativeBridgeBatchOperation = [
  NativeBridgeBatchOperationCacheBehavior,
  ?TableName<any>, // table to add/remove from cache
  SQL,
  Array<SQLiteArg[]>, // id must be at [0] if cacheBehavior != 0
]

export type InitializeStatus =
  | { code: 'ok' | 'schema_needed' }
  | { code: 'migrations_needed', databaseVersion: SchemaVersion }

export type SyncReturn<T> =
  | { status: 'success', result: T }
  | { status: 'error', code: string, message: string }

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
  | 'loadOrSaveDb'

export interface SqliteDispatcher {
  call(methodName: SqliteDispatcherMethod, args: any[], callback: ResultCallback<any>): void;
}
