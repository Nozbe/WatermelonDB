// @flow

import { type ConnectionTag } from '../../utils/common'
import { type ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { AppSchema, TableName, SchemaVersion } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'

import type { DirtyFindResult, DirtyQueryResult } from '../common'

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

type InitializeStatus =
  | { code: 'ok' | 'schema_needed' }
  | { code: 'migrations_needed', databaseVersion: SchemaVersion }

export type SyncReturn<T> =
  | { status: 'success', result: T }
  | { status: 'error', code: string, message: string }

export type NativeDispatcher = $Exact<{
  initialize: (string, SchemaVersion, ResultCallback<InitializeStatus>) => void,
  setUpWithSchema: (string, SQL, SchemaVersion, ResultCallback<void>) => void,
  setUpWithMigrations: (string, SQL, SchemaVersion, SchemaVersion, ResultCallback<void>) => void,
  find: (TableName<any>, RecordId, ResultCallback<DirtyFindResult>) => void,
  query: (TableName<any>, SQL, SQLiteArg[], ResultCallback<DirtyQueryResult>) => void,
  queryIds: (SQL, SQLiteArg[], ResultCallback<RecordId[]>) => void,
  unsafeQueryRaw: (SQL, SQLiteArg[], ResultCallback<any[]>) => void,
  count: (SQL, SQLiteArg[], ResultCallback<number>) => void,
  batch: (NativeBridgeBatchOperation[], ResultCallback<void>) => void,
  batchJSON?: (string, ResultCallback<void>) => void,
  unsafeResetDatabase: (SQL, SchemaVersion, ResultCallback<void>) => void,
  getLocal: (string, ResultCallback<?string>) => void,
}>

export type NativeBridgeType = {
  initializeJSI?: () => void,
  initialize: (ConnectionTag, string, SchemaVersion) => Promise<InitializeStatus>,
  setUpWithSchema: (ConnectionTag, string, SQL, SchemaVersion) => Promise<void>,
  setUpWithMigrations: (ConnectionTag, string, SQL, SchemaVersion, SchemaVersion) => Promise<void>,
  find: (ConnectionTag, TableName<any>, RecordId) => Promise<DirtyFindResult>,
  query: (ConnectionTag, TableName<any>, SQL, SQLiteArg[]) => Promise<DirtyQueryResult>,
  queryIds: (ConnectionTag, SQL, SQLiteArg[]) => Promise<RecordId[]>,
  unsafeQueryRaw: (ConnectionTag, SQL, SQLiteArg[]) => Promise<any[]>,
  count: (ConnectionTag, SQL, SQLiteArg[]) => Promise<number>,
  batch: (ConnectionTag, NativeBridgeBatchOperation[]) => Promise<void>,
  batchJSON?: (ConnectionTag, string) => Promise<void>,
  unsafeResetDatabase: (ConnectionTag, SQL, SchemaVersion) => Promise<void>,
  getLocal: (ConnectionTag, string) => Promise<?string>,
}
