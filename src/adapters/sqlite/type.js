// @flow

import { type ConnectionTag } from '../../utils/common'
import { type ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { AppSchema, TableName, SchemaVersion } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'

import { type DirtyFindResult, type DirtyQueryResult } from '../common'

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
  // (deprecated) use JSI instead
  synchronous?: boolean,
  // The new way to run the database in synchronous mode.
  jsi?: boolean,
  migrationEvents?: MigrationEvents,
  // Called when database failed to set up (initialize) correctly. It's possible that
  // it's some transient error that will be solved by a reload, but it's
  // very likely that the error is persistent (e.g. a corrupted database).
  // Pass a callback to offer to the user to reload the app or log out
  onSetUpError?: (error: Error) => void,
}>

export type DispatcherType = 'asynchronous' | 'synchronous' | 'jsi'

export type NativeBridgeBatchOperation =
  | ['execute', TableName<any>, SQL, SQLiteArg[]]
  | ['create', TableName<any>, RecordId, SQL, SQLiteArg[]]
  | ['markAsDeleted', TableName<any>, RecordId]
  | ['destroyPermanently', TableName<any>, RecordId]
// | ['setLocal', string, string]
// | ['removeLocal', string]

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
  query: (TableName<any>, SQL, ResultCallback<DirtyQueryResult>) => void,
  count: (SQL, ResultCallback<number>) => void,
  batch: (NativeBridgeBatchOperation[], ResultCallback<void>) => void,
  batchJSON?: (string, ResultCallback<void>) => void,
  getDeletedRecords: (TableName<any>, ResultCallback<RecordId[]>) => void,
  destroyDeletedRecords: (TableName<any>, RecordId[], ResultCallback<void>) => void,
  unsafeResetDatabase: (SQL, SchemaVersion, ResultCallback<void>) => void,
  getLocal: (string, ResultCallback<?string>) => void,
  setLocal: (string, string, ResultCallback<void>) => void,
  removeLocal: (string, ResultCallback<void>) => void,
}>

export type NativeBridgeType = {
  // Async methods
  initialize: (ConnectionTag, string, SchemaVersion) => Promise<InitializeStatus>,
  setUpWithSchema: (ConnectionTag, string, SQL, SchemaVersion) => Promise<void>,
  setUpWithMigrations: (ConnectionTag, string, SQL, SchemaVersion, SchemaVersion) => Promise<void>,
  find: (ConnectionTag, TableName<any>, RecordId) => Promise<DirtyFindResult>,
  query: (ConnectionTag, TableName<any>, SQL) => Promise<DirtyQueryResult>,
  count: (ConnectionTag, SQL) => Promise<number>,
  batch: (ConnectionTag, NativeBridgeBatchOperation[]) => Promise<void>,
  batchJSON?: (ConnectionTag, string) => Promise<void>,
  getDeletedRecords: (ConnectionTag, TableName<any>) => Promise<RecordId[]>,
  destroyDeletedRecords: (ConnectionTag, TableName<any>, RecordId[]) => Promise<void>,
  unsafeResetDatabase: (ConnectionTag, SQL, SchemaVersion) => Promise<void>,
  getLocal: (ConnectionTag, string) => Promise<?string>,
  setLocal: (ConnectionTag, string, string) => Promise<void>,
  removeLocal: (ConnectionTag, string) => Promise<void>,

  // Synchronous methods
  initializeSynchronous?: (ConnectionTag, string, SchemaVersion) => SyncReturn<InitializeStatus>,
  setUpWithSchemaSynchronous?: (ConnectionTag, string, SQL, SchemaVersion) => SyncReturn<void>,
  setUpWithMigrationsSynchronous?: (
    ConnectionTag,
    string,
    SQL,
    SchemaVersion,
    SchemaVersion,
  ) => SyncReturn<void>,
  findSynchronous?: (ConnectionTag, TableName<any>, RecordId) => SyncReturn<DirtyFindResult>,
  querySynchronous?: (ConnectionTag, TableName<any>, SQL) => SyncReturn<DirtyQueryResult>,
  countSynchronous?: (ConnectionTag, SQL) => SyncReturn<number>,
  batchSynchronous?: (ConnectionTag, NativeBridgeBatchOperation[]) => SyncReturn<void>,
  batchJSONSynchronous?: (ConnectionTag, string) => SyncReturn<void>,
  getDeletedRecordsSynchronous?: (ConnectionTag, TableName<any>) => SyncReturn<RecordId[]>,
  destroyDeletedRecordsSynchronous?: (
    ConnectionTag,
    TableName<any>,
    RecordId[],
  ) => SyncReturn<void>,
  unsafeResetDatabaseSynchronous?: (ConnectionTag, SQL, SchemaVersion) => SyncReturn<void>,
  getLocalSynchronous?: (ConnectionTag, string) => SyncReturn<?string>,
  setLocalSynchronous?: (ConnectionTag, string, string) => SyncReturn<void>,
  removeLocalSynchronous?: (ConnectionTag, string) => SyncReturn<void>,

  // Special methods
  initializeJSI?: () => void,
}
