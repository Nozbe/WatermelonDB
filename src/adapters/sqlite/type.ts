import {ConnectionTag} from '../../utils/common';
import { ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { AppSchema, TableName, SchemaVersion } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'

import { DirtyFindResult, DirtyQueryResult } from '../common'

export type SQL = string;
export type SQLiteArg = string | boolean | number | null;
export type SQLiteQuery = [SQL, SQLiteArg[]];

export type SQLiteAdapterOptions = {
  dbName?: string;
  schema: AppSchema;
  migrations?: SchemaMigrations;
  synchronous?: boolean;
  experimentalUseJSI?: boolean // don't use this one, its fake;
  onReady?: () => void;
};

export type DispatcherType = 'asynchronous' | 'synchronous' | 'jsi';

export type NativeBridgeBatchOperation = ['execute', TableName<any>, SQL, SQLiteArg[]] | ['create', TableName<any>, RecordId, SQL, SQLiteArg[]] | ['markAsDeleted', TableName<any>, RecordId] | ['destroyPermanently', TableName<any>, RecordId];
// | ['setLocal', string, string]
// | ['removeLocal', string]

type InitializeStatus = {
  code: 'ok' | 'schema_needed';
} | {
  code: 'migrations_needed';
  databaseVersion: SchemaVersion;
};

export type SyncReturn<T> = {
  status: 'success';
  result: T;
} | {
  status: 'error';
  code: string;
  message: string;
};

export type NativeDispatcher = {
  initialize: (arg1: string, arg2: SchemaVersion, arg3: ResultCallback<InitializeStatus>) => void;
  setUpWithSchema: (
    arg1: string,
    arg2: SQL,
    arg3: SchemaVersion,
    arg4: ResultCallback<undefined>,
  ) => void;
  setUpWithMigrations: (
    arg1: string,
    arg2: SQL,
    arg3: SchemaVersion,
    arg4: SchemaVersion,
    arg5: ResultCallback<undefined>,
  ) => void;
  find: (
    arg1: TableName<any>,
    arg2: RecordId,
    arg3: ResultCallback<DirtyFindResult>,
  ) => void;
  query: (arg1: TableName<any>, arg2: SQL, arg3: ResultCallback<DirtyQueryResult>) => void;
  count: (arg1: SQL, arg2: ResultCallback<number>) => void;
  batch: (arg1: NativeBridgeBatchOperation[], arg2: ResultCallback<undefined>) => void;
  batchJSON?: (arg1: string, arg2: ResultCallback<undefined>) => void;
  getDeletedRecords: (arg1: TableName<any>, arg2: ResultCallback<RecordId[]>) => void;
  destroyDeletedRecords: (arg1: TableName<any>, arg2: RecordId[], arg3: ResultCallback<undefined>) => void;
  unsafeResetDatabase: (arg1: SQL, arg2: SchemaVersion, arg3: ResultCallback<undefined>) => void;
  getLocal: (arg1: string, arg2: ResultCallback<string | null | undefined>) => void;
  setLocal: (arg1: string, arg2: string, arg3: ResultCallback<undefined>) => void;
  removeLocal: (arg1: string, arg2: ResultCallback<undefined>) => void;
  copyTables: (tables: any, srcDB: any, callback: ResultCallback<undefined>) => void;
  execSqlQuery: (arg1: SQL, arg2: SQLiteArg[], arg3: ResultCallback<DirtyQueryResult>) => void;
  enableNativeCDC: (arg1: ResultCallback<undefined>) => void;
  obliterateDatabase: (arg1: ResultCallback<undefined>) => void;
};

export type NativeBridgeType = {
  // Async methods
  initialize: (arg1: ConnectionTag, arg2: string, arg3: SchemaVersion) => Promise<InitializeStatus>;
  setUpWithSchema: (arg1: ConnectionTag, arg2: string, arg3: SQL, arg4: SchemaVersion) => Promise<void>;
  setUpWithMigrations: (
    arg1: ConnectionTag,
    arg2: string,
    arg3: SQL,
    arg4: SchemaVersion,
    arg5: SchemaVersion,
  ) => Promise<void>;
  find: (arg1: ConnectionTag, arg2: TableName<any>, arg3: RecordId) => Promise<DirtyFindResult>;
  query: (arg1: ConnectionTag, arg2: TableName<any>, arg3: SQL) => Promise<DirtyQueryResult>;
  count: (arg1: ConnectionTag, arg2: SQL) => Promise<number>;
  batch: (arg1: ConnectionTag, arg2: NativeBridgeBatchOperation[]) => Promise<void>;
  batchJSON?: (arg1: ConnectionTag, arg2: string) => Promise<void>;
  getDeletedRecords: (arg1: ConnectionTag, arg2: TableName<any>) => Promise<RecordId[]>;
  destroyDeletedRecords: (arg1: ConnectionTag, arg2: TableName<any>, arg3: RecordId[]) => Promise<void>;
  unsafeResetDatabase: (arg1: ConnectionTag, arg2: SQL, arg3: SchemaVersion) => Promise<void>;
  getLocal: (arg1: ConnectionTag, arg2: string) => Promise<string | null | undefined>;
  setLocal: (arg1: ConnectionTag, arg2: string, arg3: string) => Promise<void>;
  removeLocal: (arg1: ConnectionTag, arg2: string) => Promise<void>;
  initializeJSIBridge: () => Promise<void>;
  enableNativeCDC: (arg1: ConnectionTag) => Promise<void>;
  execSqlQuery: (arg1: ConnectionTag, arg2: SQL, arg3: SQLiteArg[]) => Promise<DirtyQueryResult>;
  // Synchronous methods
  initializeSynchronous?: (arg1: ConnectionTag, arg2: string, arg3: SchemaVersion) => SyncReturn<InitializeStatus>;
  setUpWithSchemaSynchronous?: (arg1: ConnectionTag, arg2: string, arg3: SQL, arg4: SchemaVersion) => SyncReturn<void>;
  setUpWithMigrationsSynchronous?: (
    arg1: ConnectionTag,
    arg2: string,
    arg3: SQL,
    arg4: SchemaVersion,
    arg5: SchemaVersion,
  ) => SyncReturn<void>;
  findSynchronous?: (arg1: ConnectionTag, arg2: TableName<any>, arg3: RecordId) => SyncReturn<DirtyFindResult>;
  querySynchronous?: (arg1: ConnectionTag, arg2: TableName<any>, arg3: SQL) => SyncReturn<DirtyQueryResult>;
  countSynchronous?: (arg1: ConnectionTag, arg2: SQL) => SyncReturn<number>;
  batchSynchronous?: (arg1: ConnectionTag, arg2: NativeBridgeBatchOperation[]) => SyncReturn<void>;
  batchJSONSynchronous?: (arg1: ConnectionTag, arg2: string) => SyncReturn<void>;
  getDeletedRecordsSynchronous?: (arg1: ConnectionTag, arg2: TableName<any>) => SyncReturn<RecordId[]>;
  destroyDeletedRecordsSynchronous?: (arg1: ConnectionTag, arg2: TableName<any>, arg3: RecordId[]) => SyncReturn<void>;
  unsafeResetDatabaseSynchronous?: (arg1: ConnectionTag, arg2: SQL, arg3: SchemaVersion) => SyncReturn<void>;
  getLocalSynchronous?: (arg1: ConnectionTag, arg2: string) => SyncReturn<string | null | undefined>;
  setLocalSynchronous?: (arg1: ConnectionTag, arg2: string, arg3: string) => SyncReturn<void>;
  removeLocalSynchronous?: (arg1: ConnectionTag, arg2: string) => SyncReturn<void>;
  // Special methods
  initializeJSI?: () => void;
  copyTables?: (arg1: TableName<any>[], arg2?: any) => Promise<void>;
};
