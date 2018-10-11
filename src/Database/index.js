// @flow

import type { Observable } from 'rxjs/Observable'
import { merge as merge$ } from 'rxjs/observable/merge'
import { startWith } from 'rxjs/operators'
import { values } from 'rambdax'

import { invariant } from '../utils/common'

import CollectionMap from './CollectionMap'

import type { DatabaseAdapter } from '../adapters/type'
import type Model from '../Model'
import type { CollectionChangeSet } from '../Collection'
import type { TableName, AppSchema } from '../Schema'

// Database is the owner of all Collections and the DatabaseAdapter

export default class Database {
  adapter: DatabaseAdapter

  schema: AppSchema

  collections: CollectionMap

  constructor({
    adapter,
    modelClasses,
  }: $Exact<{
    adapter: DatabaseAdapter,
    modelClasses: Array<Class<Model>>,
  }>): void {
    this.adapter = adapter
    this.schema = adapter.schema
    this.collections = new CollectionMap(this, modelClasses)
  }

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  async batch(...records: $ReadOnlyArray<Model>): Promise<void> {
    const operations = records.map(record => {
      invariant(
        !record._isCommitted || record._hasPendingUpdate,
        `Cannot batch a record that doesn't have a prepared create or prepared update`,
      )

      if (record._hasPendingUpdate) {
        record._hasPendingUpdate = false // TODO: What if this fails?
        return ['update', record]
      }

      return ['create', record]
    })
    await this.adapter.batch(operations)

    operations.forEach(([type, record]) => {
      const { collection } = record
      if (type === 'create') {
        collection._onRecordCreated(record)
      } else if (type === 'update') {
        collection._onRecordUpdated(record)
      }
    })
  }

  // Emits a signal immediately, and on change in any of the passed tables
  withChangesForTables(tables: TableName<any>[]): Observable<CollectionChangeSet<any> | null> {
    const changesSignals = tables.map(table => this.collections.get(table).changes)

    return merge$(...changesSignals).pipe(startWith(null))
  }

  // This only works correctly when no Models are being observed!
  async unsafeResetDatabase(): Promise<void> {
    this._unsafeClearCaches()
    await this.adapter.unsafeResetDatabase()
  }

  _unsafeClearCaches(): void {
    values(this.collections.map).forEach(collection => {
      collection.unsafeClearCache()
    })
  }
}
