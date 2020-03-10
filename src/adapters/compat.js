// @flow

import type { SerializedQuery } from '../Query'
import type { TableName, AppSchema } from '../Schema'
import type { SchemaMigrations } from '../Schema/migrations'
import type { RecordId } from '../Model'
import { toPromise } from '../utils/fp/Result'

import type {
  DatabaseAdapter,
  CachedFindResult,
  CachedQueryResult,
  BatchOperation,
  SQLDatabaseAdapter,
} from './type'

export default class DatabaseAdapterCompat {
  underlyingAdapter: DatabaseAdapter

  constructor(adapter: DatabaseAdapter): void {
    this.underlyingAdapter = adapter

    const sqlAdapter: SQLDatabaseAdapter = (adapter: any)
    if (sqlAdapter.unsafeSqlQuery) {
      this.unsafeSqlQuery = (tableName, sql) =>
        toPromise(callback => sqlAdapter.unsafeSqlQuery(tableName, sql, callback))
    }
  }

  get schema(): AppSchema {
    return this.underlyingAdapter.schema
  }

  get migrations(): ?SchemaMigrations {
    return this.underlyingAdapter.migrations
  }

  find(table: TableName<any>, id: RecordId): Promise<CachedFindResult> {
    return toPromise(callback => this.underlyingAdapter.find(table, id, callback))
  }

  query(query: SerializedQuery): Promise<CachedQueryResult> {
    return toPromise(callback => this.underlyingAdapter.query(query, callback))
  }

  count(query: SerializedQuery): Promise<number> {
    return toPromise(callback => this.underlyingAdapter.count(query, callback))
  }

  batch(operations: BatchOperation[]): Promise<void> {
    return toPromise(callback => this.underlyingAdapter.batch(operations, callback))
  }

  getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]> {
    return toPromise(callback => this.underlyingAdapter.getDeletedRecords(tableName, callback))
  }

  destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void> {
    return toPromise(callback =>
      this.underlyingAdapter.destroyDeletedRecords(tableName, recordIds, callback),
    )
  }

  unsafeResetDatabase(): Promise<void> {
    return toPromise(callback => this.underlyingAdapter.unsafeResetDatabase(callback))
  }

  getLocal(key: string): Promise<?string> {
    return toPromise(callback => this.underlyingAdapter.getLocal(key, callback))
  }

  setLocal(key: string, value: string): Promise<void> {
    return toPromise(callback => this.underlyingAdapter.setLocal(key, value, callback))
  }

  removeLocal(key: string): Promise<void> {
    return toPromise(callback => this.underlyingAdapter.removeLocal(key, callback))
  }

  unsafeSqlQuery: ?(tableName: TableName<any>, sql: string) => Promise<CachedQueryResult>

  // untyped - test-only code
  testClone(options: any): any {
    // $FlowFixMe
    return new DatabaseAdapterCompat(this.underlyingAdapter.testClone(options))
  }
}
