// @flow

import Loki, { LokiCollection, type LokiMemoryAdapter } from 'lokijs'
import { prop, forEach, values } from 'rambdax'
import { logger } from '../../../utils/common'

import type { CachedQueryResult, CachedFindResult, BatchOperation } from '../../type'
import type { TableName, AppSchema, SchemaVersion, TableSchema } from '../../../Schema'
import type {
  SchemaMigrations,
  CreateTableMigrationStep,
  AddColumnsMigrationStep,
  MigrationStep,
} from '../../../Schema/migrations'
import { stepsForMigration } from '../../../Schema/migrations/helpers'
import type { SerializedQuery } from '../../../Query'
import type { RecordId } from '../../../Model'
import { type RawRecord, sanitizedRaw, setRawSanitized, type DirtyRaw } from '../../../RawRecord'

import { newLoki, deleteDatabase } from './lokiExtensions'
import executeQuery from './executeQuery'

import type { LokiAdapterOptions } from '../index'

const SCHEMA_VERSION_KEY = '_loki_schema_version'

export default class LokiExecutor {
  dbName: ?string

  schema: AppSchema

  migrations: ?SchemaMigrations

  loki: Loki

  experimentalUseIncrementalIndexedDB: boolean

  onIndexedDBVersionChange: ?() => void

  onQuotaExceededError: ?(error: Error) => void

  _testLokiAdapter: ?LokiMemoryAdapter

  cachedRecords: Map<TableName<any>, Set<RecordId>> = new Map()

  constructor(options: LokiAdapterOptions): void {
    const { dbName, schema, migrations, _testLokiAdapter } = options
    this.dbName = dbName
    this.schema = schema
    this.migrations = migrations
    this.experimentalUseIncrementalIndexedDB = options.experimentalUseIncrementalIndexedDB || false
    this.onIndexedDBVersionChange = options.onIndexedDBVersionChange
    this.onQuotaExceededError = options.onQuotaExceededError
    this._testLokiAdapter = _testLokiAdapter
  }

  async setUp(): Promise<void> {
    await this._openDatabase()
    await this._migrateIfNeeded()
  }

  isCached(table: TableName<any>, id: RecordId): boolean {
    const cachedSet = this.cachedRecords.get(table)
    return cachedSet ? cachedSet.has(id) : false
  }

  markAsCached(table: TableName<any>, id: RecordId): void {
    const cachedSet = this.cachedRecords.get(table)
    if (cachedSet) {
      cachedSet.add(id)
    } else {
      this.cachedRecords.set(table, new Set([id]))
    }
  }

  removeFromCache(table: TableName<any>, id: RecordId): void {
    const cachedSet = this.cachedRecords.get(table)
    if (cachedSet) {
      cachedSet.delete(id)
    }
  }

  find(table: TableName<any>, id: RecordId): CachedFindResult {
    if (this.isCached(table, id)) {
      return id
    }

    const raw = this.loki.getCollection(table).by('id', id)

    if (!raw) {
      return null
    }

    this.markAsCached(table, id)
    return sanitizedRaw(raw, this.schema.tables[table])
  }

  query(query: SerializedQuery): CachedQueryResult {
    const records = executeQuery(query, this.loki).data()
    return this._compactQueryResults(records, query.table)
  }

  count(query: SerializedQuery): number {
    return executeQuery(query, this.loki).count()
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
    this.removeFromCache(table, id)
  }

  markAsDeleted(table: TableName<any>, id: RecordId): void {
    const collection = this.loki.getCollection(table)
    const record = collection.by('id', id)
    if (record) {
      record._status = 'deleted'
      collection.update(record)
      this.removeFromCache(table, id)
    }
  }

  batch(operations: BatchOperation[]): void {
    // TODO: Only add to cached records if all is successful
    // TODO: Transactionality

    const recordsToCreate: { [TableName<any>]: RawRecord[] } = {}

    operations.forEach(operation => {
      const [type, table, raw] = operation
      switch (type) {
        case 'create':
          if (!recordsToCreate[table]) {
            recordsToCreate[table] = []
          }
          recordsToCreate[table].push((raw: $FlowFixMe<RawRecord>))

          break
        default:
          break
      }
    })

    // We're doing a second pass, because batch insert is much faster in Loki
    Object.entries(recordsToCreate).forEach((args: any) => {
      const [table, raws]: [TableName<any>, RawRecord[]] = args
      const shouldRebuildIndexAfterIndex = raws.length >= 1000 // only profitable for large inserts
      this.loki.getCollection(table).insert(raws, shouldRebuildIndexAfterIndex)

      raws.forEach(raw => {
        this.markAsCached(table, raw.id)
      })
    })

    operations.forEach(operation => {
      const [type, table, rawOrId] = operation
      switch (type) {
        case 'update':
          this.update(table, (rawOrId: $FlowFixMe<RawRecord>))
          break
        case 'markAsDeleted':
          this.markAsDeleted(table, (rawOrId: $FlowFixMe<RecordId>))
          break
        case 'destroyPermanently':
          this.destroyPermanently(table, (rawOrId: $FlowFixMe<RecordId>))
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
    logger.log('[WatermelonDB][Loki] Database is now reset')

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

  // *** Internals ***

  async _openDatabase(): Promise<void> {
    logger.log('[WatermelonDB][Loki] Initializing IndexedDB')

    this.loki = await newLoki(
      this.dbName,
      this._testLokiAdapter,
      this.experimentalUseIncrementalIndexedDB,
      this.onIndexedDBVersionChange,
      this.onQuotaExceededError,
    )

    logger.log('[WatermelonDB][Loki] Database loaded')
  }

  _setUpSchema(): void {
    logger.log('[WatermelonDB][Loki] Setting up schema')

    // Add collections
    values(this.schema.tables).forEach(tableSchema => {
      this._addCollection(tableSchema)
    })

    this.loki.addCollection('local_storage', {
      unique: ['key'],
      indices: [],
      disableMeta: true,
    })

    // Set database version
    this._databaseVersion = this.schema.version

    logger.log('[WatermelonDB][Loki] Database collections set up')
  }

  _addCollection(tableSchema: TableSchema): void {
    const { name, columns } = tableSchema
    const indexedColumns = values(columns).reduce(
      (indexes, column) => (column.isIndexed ? indexes.concat([(column.name: string)]) : indexes),
      [],
    )

    this.loki.addCollection(name, {
      unique: ['id'],
      indices: ['_status', ...indexedColumns],
      disableMeta: true,
    })
  }

  get _databaseVersion(): SchemaVersion {
    const databaseVersionRaw = this.getLocal(SCHEMA_VERSION_KEY) || ''
    return parseInt(databaseVersionRaw, 10) || 0
  }

  set _databaseVersion(version: SchemaVersion): void {
    this.setLocal(SCHEMA_VERSION_KEY, `${version}`)
  }

  async _migrateIfNeeded(): Promise<void> {
    const dbVersion = this._databaseVersion
    const schemaVersion = this.schema.version

    if (dbVersion === schemaVersion) {
      // All good!
    } else if (dbVersion === 0) {
      logger.log('[WatermelonDB][Loki] Empty database, setting up')
      await this.unsafeResetDatabase()
    } else if (dbVersion > 0 && dbVersion < schemaVersion) {
      logger.log('[WatermelonDB][Loki] Database has old schema version. Migration is required.')
      const migrationSteps = this._getMigrationSteps(dbVersion)

      if (migrationSteps) {
        logger.log(
          `[WatermelonDB][Loki] Migrating from version ${dbVersion} to ${this.schema.version}...`,
        )
        try {
          await this._migrate(migrationSteps)
        } catch (error) {
          logger.error('[WatermelonDB][Loki] Migration failed', error)
          throw error
        }
      } else {
        logger.warn(
          '[WatermelonDB][Loki] Migrations not available for this version range, resetting database instead',
        )
        await this.unsafeResetDatabase()
      }
    } else {
      logger.warn(
        '[WatermelonDB][Loki] Database has newer version than app schema. Resetting database.',
      )
      await this.unsafeResetDatabase()
    }
  }

  _getMigrationSteps(fromVersion: SchemaVersion): ?(MigrationStep[]) {
    // TODO: Remove this after migrations are shipped
    const { migrations } = this
    if (!migrations) {
      return null
    }

    return stepsForMigration({
      migrations,
      fromVersion,
      toVersion: this.schema.version,
    })
  }

  async _migrate(steps: MigrationStep[]): Promise<void> {
    steps.forEach(step => {
      if (step.type === 'create_table') {
        this._executeCreateTableMigration(step)
      } else if (step.type === 'add_columns') {
        this._executeAddColumnsMigration(step)
      } else {
        throw new Error(`Unsupported migration step ${step.type}`)
      }
    })

    // Set database version
    this._databaseVersion = this.schema.version

    logger.log(`[WatermelonDB][Loki] Migration successful`)
  }

  _executeCreateTableMigration({ schema }: CreateTableMigrationStep): void {
    this._addCollection(schema)
  }

  _executeAddColumnsMigration({ table, columns }: AddColumnsMigrationStep): void {
    const collection = this.loki.getCollection(table)

    // update ALL records in the collection, adding new fields
    collection.findAndUpdate({}, record => {
      columns.forEach(column => {
        setRawSanitized(record, column.name, null, column)
      })
    })

    // add indexes, if needed
    columns.forEach(column => {
      if (column.isIndexed) {
        collection.ensureIndex(column.name)
      }
    })
  }

  // Maps records to their IDs if the record is already cached on JS side
  _compactQueryResults(records: DirtyRaw[], table: TableName<any>): CachedQueryResult {
    return records.map(raw => {
      const { id } = raw

      if (this.isCached(table, id)) {
        return id
      }

      this.markAsCached(table, id)
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
