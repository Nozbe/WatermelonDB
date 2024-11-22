// @flow

import { type ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { SerializedQuery } from '../../Query'
import type { TableName, AppSchema } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'
import type {
  DatabaseAdapter,
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
  UnsafeExecuteOperations,
} from '../type'

type RemoteHandler = (op: string, args: any[], callback: ResultCallback<any>) => void;

type RemoteAdapterOptions = {
    schema: AppSchema, 
    migrations?: SchemaMigrations,
    handler: RemoteHandler,
}

export default class RemoteAdapter implements DatabaseAdapter {
    schema: AppSchema
    dbName: string
    migrations: ?SchemaMigrations
    handler: RemoteHandler

    constructor(options: RemoteAdapterOptions) {
        const { schema, migrations, handler } = options;

        this.schema = schema
        this.migrations = migrations
        this.handler = handler
    }

    find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>) {
        this.handler('find', [table, id], callback)
    }

    query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>) {
        this.handler('query', [query], callback)
    }

    queryIds(query: SerializedQuery, callback: ResultCallback<RecordId[]>) {
        this.handler('queryIds', [query], callback) 
    }

    unsafeQueryRaw(query: SerializedQuery, callback: ResultCallback<any[]>) {
        this.handler('unsafeQueryRaw', [query], callback) 
    }

    count(query: SerializedQuery, callback: ResultCallback<number>) {
        this.handler('count', [query], callback) 
    }

    batch(operations: BatchOperation[], callback: ResultCallback<void>) {
        this.handler('batch', [operations], callback) 
    }

    getDeletedRecords(tableName: TableName<any>, callback: ResultCallback<RecordId[]>) {
        this.handler('getDeletedRecords', [tableName], callback) 
    }

    destroyDeletedRecords(
        tableName: TableName<any>,
        recordIds: RecordId[],
        callback: ResultCallback<void>,
    ) {
        this.handler('batch', [tableName, recordIds], callback) 
    }

    unsafeLoadFromSync(jsonId: number, callback: ResultCallback<any>) {
        this.handler('unsafeLoadFromSync', [jsonId], callback) 
    }

    provideSyncJson(id: number, syncPullResultJson: string, callback: ResultCallback<void>) {
        this.handler('provideSyncJson', [id, syncPullResultJson], callback) 
    }

    unsafeResetDatabase(callback: ResultCallback<void>) {
        this.handler('unsafeResetDatabase', [], callback) 
    }

    unsafeExecute(work: UnsafeExecuteOperations, callback: ResultCallback<void>) {
        this.handler('unsafeExecute', [work], callback) 
    }

    getLocal(key: string, callback: ResultCallback<?string>) {
        this.handler('getLocal', [key], callback) 
    }

    setLocal(key: string, value: string, callback: ResultCallback<void>) {
        this.handler('getLocal', [key, value], callback) 
    }

    removeLocal(key: string, callback: ResultCallback<void>) {
        this.handler('getLocal', [key], callback) 
    }
}