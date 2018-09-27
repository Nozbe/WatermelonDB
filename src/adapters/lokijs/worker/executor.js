// @flow

import Loki, { LokiCollection } from 'lokijs'
import { prop, forEach, values } from 'rambdax'
import { logger } from 'utils/common'

import type { CachedQueryResult, CachedFindResult } from 'adapters/type'
import type { TableName, AppSchema } from 'Schema'
import type { SerializedQuery } from 'Query'
import type { RecordId } from 'Model'
import { type RawRecord, sanitizedRaw, type DirtyRaw } from 'RawRecord'

import { type SchemaMigrations } from '../../../Schema/migrations'
import { newLoki, loadDatabase, deleteDatabase } from './lokiExtensions'
import executeQuery from './executeQuery'
import type { WorkerBatchOperation } from '../common'

const SCHEMA_VERSION_KEY = '_loki_schema_version'

type LokiExecutorOptions = $Exact<{
  dbName: string,
  schema: AppSchema,
  migrations: ?SchemaMigrations, // TODO: not optional
}>

export default class LokiExecutor {
  dbName: string

  schema: AppSchema

  migrations: ?SchemaMigrations

  loki: Loki

  cachedRecords: Set<RecordId> = new Set([])

  constructor(options: LokiExecutorOptions): void {
    const { dbName, schema, migrations } = options
    this.dbName = dbName
    this.schema = schema
    this.migrations = migrations
  }

  async setUp(): Promise<void> {
    await this._openDatabase()
    await this._migrateIfNeeded()
  }

  find(table: TableName<any>, id: RecordId): CachedFindResult {
    if (this.cachedRecords.has(id)) {
      return id
    }

    const raw = this.loki.getCollection(table).by('id', id)

    if (!raw) {
      return null
    }

    this.cachedRecords.add(id)
    return sanitizedRaw(raw, this.schema.tables[table])
  }

  query(query: SerializedQuery): CachedQueryResult {
    const records = executeQuery(query, this.loki).data()
    return this._compactQueryResults(records, query.table)
  }

  count(query: SerializedQuery): number {
    return executeQuery(query, this.loki).count()
  }

  create(table: TableName<any>, raw: RawRecord): void {
    this.loki.getCollection(table).insert(raw)
    this.cachedRecords.add(raw.id)
  }

  update(table: TableName<any>, rawRecord: RawRecord): void {
    const collection = this.loki.getCollection(table)
    // Loki identifies records using internal $loki ID so we must find the saved record first
    const lokiId = collection.by('id', rawRecord.id).$loki
    const raw: DirtyRaw = rawRecord
    raw.$loki = lokiId
    collection.update(raw)
  }

  destroyPermanently(table: TableName<any>, id: RecordId): void {
    const collection = this.loki.getCollection(table)
    const record = collection.by('id', id)
    collection.remove(record)
    this.cachedRecords.delete(id)
  }

  markAsDeleted(table: TableName<any>, id: RecordId): void {
    const collection = this.loki.getCollection(table)
    const record = collection.by('id', id)
    if (record) {
      record._status = 'deleted'
      collection.update(record)
      this.cachedRecords.delete(id)
    }
  }

  batch(operations: WorkerBatchOperation[]): void {
    // TODO: Only add to cached records if all is successful
    // TODO: Transactionality
    operations.forEach(operation => {
      const [type, table, raw] = operation
      switch (type) {
        case 'create':
          this.create(table, raw)
          break
        case 'update':
          this.update(table, raw)
          break
        case 'markAsDeleted':
          this.markAsDeleted(table, raw.id)
          break
        case 'destroyPermanently':
          this.destroyPermanently(table, raw.id)
          break
        default:
          break
      }
    })
  }

  getDeletedRecords(table: TableName<any>): RecordId[] {
    return this.loki
      .getCollection(table)
      .find({ _status: { $eq: 'deleted' } })
      .map(prop('id'))
  }

  destroyDeletedRecords(table: TableName<any>, records: RecordId[]): void {
    const collection = this.loki.getCollection(table)
    forEach(recordId => {
      const record = collection.by('id', recordId)

      record && collection.remove(record)
    }, records)
  }

  async unsafeResetDatabase(): Promise<void> {
    await deleteDatabase(this.loki)

    this.cachedRecords.clear()
    logger.log('[DB][Worker] Database is now reset')

    await this._openDatabase()
    this._setUpSchema()
  }

  // *** LocalStorage ***

  getLocal(key: string): ?string {
    const record = this._findLocal(key)
    return record ? record.value : null
  }

  setLocal(key: string, value: string): void {
    const record = this._findLocal(key)

    if (record) {
      record.value = value
      this._localStorage.update(record)
    } else {
      const newRecord = { key, value }
      this._localStorage.insert(newRecord)
    }
  }

  removeLocal(key: string): void {
    const record = this._findLocal(key)

    if (record) {
      this._localStorage.remove(record)
    }
  }

  unsafeClearCachedRecords(): void {
    if (process.env.NODE_ENV === 'test') {
      this.cachedRecords.clear()
    }
  }

  // *** Internals ***

  async _openDatabase(): Promise<void> {
    logger.log('[DB][Worker] Initializing IndexedDB')

    this.loki = newLoki(this.dbName)
    await loadDatabase(this.loki) // Force database to load now

    logger.log('[DB][Worker] Database loaded')
  }

  _setUpSchema(): void {
    logger.log('[DB][Worker] Setting up schema')

    // Add collections
    values(this.schema.tables).forEach(({ name, columns }) => {
      const indexedColumns = values(columns).reduce(
        (indexes, column) => (column.isIndexed ? indexes.concat([(column.name: string)]) : indexes),
        [],
      )

      this.loki.addCollection(name, {
        unique: ['id'],
        indices: ['_status', ...indexedColumns],
        disableMeta: true,
      })
    })

    this.loki.addCollection('local_storage', {
      unique: ['key'],
      indices: [],
      disableMeta: true,
    })

    // Set database version
    this.setLocal(SCHEMA_VERSION_KEY, `${this.schema.version}`)

    logger.log('[DB][Worker] Database collections set up')
  }

  get _requiresMigration(): boolean {
    const databaseVersionRaw = this.getLocal(SCHEMA_VERSION_KEY) || ''
    const databaseVersion = parseInt(databaseVersionRaw, 10) || 0

    return databaseVersion !== this.schema.version
  }

  async _migrateIfNeeded(): Promise<void> {
    if (this._requiresMigration) {
      logger.log('[DB][Worker] Database has old schema version. Migration is required.')

      if (this.migrations) {
        logger.log('[DB][Worker] Migrations available, migrating schema…')
        throw new Error('Oops! Migrations not implemented')
      } else {
        // TODO: Delete this altogether? Or put under "development" flag only?
        logger.warn('[DB][Worker] No migrations available, resetting database')
        await this.unsafeResetDatabase()
      }
    }
  }

  // Maps records to their IDs if the record is already cached on JS side
  _compactQueryResults(records: DirtyRaw[], table: TableName<any>): CachedQueryResult {
    return records.map(raw => {
      const { id } = raw

      if (this.cachedRecords.has(id)) {
        return id
      }

      this.cachedRecords.add(id)
      return sanitizedRaw(raw, this.schema.tables[table])
    })
  }

  get _localStorage(): LokiCollection {
    return this.loki.getCollection('local_storage')
  }

  _findLocal(key: string): ?{ value: string } {
    const localStorage = this._localStorage
    return localStorage && localStorage.by('key', key)
  }
}
