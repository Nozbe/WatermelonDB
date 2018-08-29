// @flow

import { NativeModules } from 'react-native'
import { devMeasureTimeAsync, connectionTag, type ConnectionTag, logger } from 'utils/common'

import type Model, { RecordId } from 'Model'
import type Query from 'Query'
import type { TableName, AppSchema } from 'Schema'
import type {
  DatabaseAdapter,
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
} from 'adapters/type'
import {
  type DirtyFindResult,
  type DirtyQueryResult,
  sanitizeFindResult,
  sanitizeQueryResult,
} from 'adapters/common'

import encodeQuery from './encodeQuery'
import encodeUpdate from './encodeUpdate'
import encodeInsert from './encodeInsert'
import encodeSchema from './encodeSchema'

export type SQL = string
export type SQLiteArg = string | boolean | number | null
export type SQLiteQuery = [SQL, SQLiteArg[]]

type NativeBridgeBatchOperation =
  | ['execute', SQL, SQLiteArg[]]
  | ['create', RecordId, SQL, SQLiteArg[]]
  | ['markAsDeleted', TableName<any>, RecordId]
  | ['destroyPermanently', TableName<any>, RecordId]
// | ['setLocal', string, string]
// | ['removeLocal', string]

type NativeBridgeType = {
  setUp: (ConnectionTag, string, SQL, number) => Promise<void>,
  find: (ConnectionTag, TableName<any>, RecordId) => Promise<DirtyFindResult>,
  query: (ConnectionTag, SQL) => Promise<DirtyQueryResult>,
  count: (ConnectionTag, SQL) => Promise<number>,
  batch: (ConnectionTag, NativeBridgeBatchOperation[]) => Promise<void>,
  getDeletedRecords: (ConnectionTag, TableName<any>) => Promise<RecordId[]>,
  destroyDeletedRecords: (ConnectionTag, TableName<any>, RecordId[]) => Promise<void>,
  unsafeResetDatabase: ConnectionTag => Promise<void>,
  getLocal: (ConnectionTag, string) => Promise<?string>,
  setLocal: (ConnectionTag, string, string) => Promise<void>,
  removeLocal: (ConnectionTag, string) => Promise<void>,
  unsafeClearCachedRecords: ConnectionTag => Promise<void>,
}
const Native: NativeBridgeType = NativeModules.DatabaseBridge

export type SQLiteAdapterOptions = $Exact<{
  dbName: string,
  schema: AppSchema,
}>

export default class SQLiteAdapter implements DatabaseAdapter {
  schema: AppSchema

  _tag: ConnectionTag = connectionTag()

  constructor(options: SQLiteAdapterOptions): void {
    this._setUp(options)
  }

  async _setUp({ dbName, schema }: SQLiteAdapterOptions): Promise<void> {
    this.schema = schema
    try {
      const schemaSQL = encodeSchema(schema)
      const [, time] = await devMeasureTimeAsync(() =>
        Native.setUp(this._tag, dbName, schemaSQL, schema.version),
      )
      logger.log(`[DB] All set up in ${time}ms`)
    } catch (error) {
      logger.error(`[DB] Uh-oh. Database failed to load, we're in big trouble`, error)
    }
  }

  async find(table: TableName<any>, id: RecordId): Promise<CachedFindResult> {
    const [dirtyRecord, time] = await devMeasureTimeAsync(() => Native.find(this._tag, table, id))

    logger.log(`[DB] Found ${table}#${id} in ${time}ms`)
    return sanitizeFindResult(dirtyRecord, this.schema.tables[table])
  }

  async query<T: Model>(query: Query<T>): Promise<CachedQueryResult> {
    const [dirtyRecords, time] = await devMeasureTimeAsync(() =>
      Native.query(this._tag, encodeQuery(query)),
    )

    logger.log(`[DB] Loaded ${dirtyRecords.length} ${query.table} in ${time}ms`)
    return sanitizeQueryResult(dirtyRecords, this.schema.tables[query.table])
  }

  async count<T: Model>(query: Query<T>): Promise<number> {
    const [count, time] = await devMeasureTimeAsync(() =>
      Native.count(this._tag, encodeQuery(query, true)),
    )
    logger.log(`[DB] Counted ${count} ${query.table} in ${time}ms`)
    return count
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    if (!operations.length) {
      return
    }

    const [, time] = await devMeasureTimeAsync(async () => {
      await Native.batch(
        this._tag,
        operations.map(([type, record]) => {
          switch (type) {
            case 'create':
              return ['create', record.id, ...encodeInsert(record)]
            case 'markAsDeleted':
              return ['markAsDeleted', record.table, record.id]
            case 'destroyPermanently':
              return ['destroyPermanently', record.table, record.id]
            default:
              // case 'update':
              return ['execute', ...encodeUpdate(record)]
          }
        }),
      )
    })

    const [type, { table }] = operations[0]
    logger.log(
      `[DB] Executed batch of ${
        operations.length
      } operations (first: ${type} on ${table}) in ${time}ms`,
    )
  }

  getDeletedRecords(table: TableName<any>): Promise<RecordId[]> {
    return Native.getDeletedRecords(this._tag, table)
  }

  destroyDeletedRecords(table: TableName<any>, recordIds: RecordId[]): Promise<void> {
    return Native.destroyDeletedRecords(this._tag, table, recordIds)
  }

  async unsafeResetDatabase(): Promise<void> {
    await Native.unsafeResetDatabase(this._tag)
    logger.log('[DB] Database is now reset')
  }

  getLocal(key: string): Promise<?string> {
    return Native.getLocal(this._tag, key)
  }

  setLocal(key: string, value: string): Promise<void> {
    return Native.setLocal(this._tag, key, value)
  }

  removeLocal(key: string): Promise<void> {
    return Native.removeLocal(this._tag, key)
  }

  unsafeClearCachedRecords(): Promise<void> {
    return Native.unsafeClearCachedRecords(this._tag)
  }
}
