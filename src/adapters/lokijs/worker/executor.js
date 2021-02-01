// @flow

// don't import the whole utils/ here!
import logger from '../../../utils/common/logger'

import type { CachedQueryResult, CachedFindResult, BatchOperation } from '../../type'
import type { TableName, AppSchema, SchemaVersion, TableSchema, ColumnSchema } from '../../../Schema'
import type {
  SchemaMigrations,
  CreateTableMigrationStep,
  AddColumnsMigrationStep,
  MigrationStep,
} from '../../../Schema/migrations'
import type { SerializedQuery } from '../../../Query'
import type { RecordId } from '../../../Model'
import { type RawRecord, sanitizedRaw, setRawSanitized, type DirtyRaw } from '../../../RawRecord'
import type { Loki, LokiCollection } from '../type'

import { newLoki, deleteDatabase, lokiFatalError } from './lokiExtensions'
import executeQuery from './executeQuery'

import type { LokiAdapterOptions } from '../index'

const SCHEMA_VERSION_KEY = '_loki_schema_version'

let experimentalAllowsFatalError = false

export function setExperimentalAllowsFatalError(): void {
  experimentalAllowsFatalError = true
}

export default class LokiExecutor {
  options: LokiAdapterOptions

  schema: AppSchema

  migrations: ?SchemaMigrations

  loki: Loki

  cachedRecords: Map<TableName<any>, Set<RecordId>> = new Map()

  // (experimental) if true, Executor is in a broken state and should not be used anymore
  _isBroken: boolean = false

  constructor(options: LokiAdapterOptions): void {
    const { schema, migrations } = options
    this.options = options
    this.schema = schema
    this.migrations = migrations
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

  clearCachedRecords(): void {
    this.cachedRecords = new Map()
  }

  getCache(table: TableName<any>): Set<RecordId> {
    const cache = this.cachedRecords.get(table)
    if (cache) {
      return cache
    }

    const newCache = new Set([])
    this.cachedRecords.set(table, newCache)
    return newCache
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

  _update(table: TableName<any>, rawRecord: RawRecord): void {
    const collection = this.loki.getCollection(table)
    // Loki identifies records using internal $loki ID so we must find the saved record first
    const lokiId = collection.by('id', rawRecord.id).$loki
    const raw: DirtyRaw = rawRecord
    raw.$loki = lokiId
    collection.update(raw)
  }

  _destroyPermanently(table: TableName<any>, id: RecordId): void {
    const collection = this.loki.getCollection(table)
    const record = collection.by('id', id)
    collection.remove(record)
    this.removeFromCache(table, id)
  }

  _markAsDeleted(table: TableName<any>, id: RecordId): void {
    const collection = this.loki.getCollection(table)
    const record = collection.by('id', id)
    if (record) {
      record._status = 'deleted'
      collection.update(record)
      this.removeFromCache(table, id)
    }
  }

  batch(operations: BatchOperation[]): void {
    // NOTE: Mutations to LokiJS db are *not* transactional!
    // This is terrible and lame for a database, but there's just no simple and good solution to this
    // Loki transactions rely on making a full copy of the data, and reverting to it if something breaks.
    // This is just unbearable for production-sized databases (too much memory required)
    // It could be done with some sort of advanced journaling/CoW structure scheme, but that would
    // be very complicated (in itself a source of bugs), and possibly quite expensive cpu-wise
    //
    // So instead, we assume that writes MUST succeed. If they don't, we put LokiExecutor in a "broken"
    // state, refuse to persist or further mutate the DB, and notify the app (and user) about it.
    //
    // It can be assumed that Loki-level mutations that fail are WatermelonDB bugs that must be fixed
    this._assertNotBroken()
    try {
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
        const shouldRebuildIndexAfterInsert = raws.length >= 1000 // only profitable for large inserts
        this.loki.getCollection(table).insert(raws, shouldRebuildIndexAfterInsert)

        const cache = this.getCache(table)
        raws.forEach(raw => {
          cache.add(raw.id)
        })
      })

      operations.forEach(operation => {
        const [type, table, rawOrId] = operation
        switch (type) {
          case 'update':
            this._update(table, (rawOrId: $FlowFixMe<RawRecord>))
            break
          case 'markAsDeleted':
            this._markAsDeleted(table, (rawOrId: $FlowFixMe<RecordId>))
            break
          case 'destroyPermanently':
            this._destroyPermanently(table, (rawOrId: $FlowFixMe<RecordId>))
            break
          default:
            break
        }
      })
    } catch (error) {
      this._fatalError(error)
    }
  }

  getDeletedRecords(table: TableName<any>): RecordId[] {
    return this.loki
      .getCollection(table)
      .find({ _status: { $eq: 'deleted' } })
      .map(record => record.id)
  }

  destroyDeletedRecords(table: TableName<any>, records: RecordId[]): void {
    this._assertNotBroken()
    try {
      const collection = this.loki.getCollection(table)
      records.forEach(recordId => {
        const record = collection.by('id', recordId)

        record && collection.remove(record)
      })
    } catch (error) {
      this._fatalError(error)
    }
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
    this._assertNotBroken()
    try {
      const record = this._findLocal(key)

      if (record) {
        record.value = value
        this._localStorage.update(record)
      } else {
        const newRecord = { key, value }
        this._localStorage.insert(newRecord)
      }
    } catch (error) {
      this._fatalError(error)
    }
  }

  removeLocal(key: string): void {
    this._assertNotBroken()
    try {
      const record = this._findLocal(key)

      if (record) {
        this._localStorage.remove(record)
      }
    } catch (error) {
      this._fatalError(error)
    }
  }

  // *** Internals ***

  async _openDatabase(): Promise<void> {
    logger.log('[WatermelonDB][Loki] Initializing IndexedDB')

    this.loki = await newLoki(this.options)

    logger.log('[WatermelonDB][Loki] Database loaded')
  }

  _setUpSchema(): void {
    logger.log('[WatermelonDB][Loki] Setting up schema')

    // Add collections
    const tables: TableSchema[] = (Object.values(this.schema.tables): any)
    tables.forEach(tableSchema => {
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
    const { name, columnArray } = tableSchema
    const indexedColumns: string[] = columnArray.reduce(
      (indexes: string[], column) => (
        column.isIndexed ? indexes.concat([(column.name: string)]) : indexes
      ),
      [],
    )

    this._warnAboutLackingFTSSupport(values(columns))

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

    const { stepsForMigration } = require('../../../Schema/migrations/stepsForMigration')
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
      } else if (step.type === 'sql') {
        // ignore
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

    this._warnAboutLackingFTSSupport(columns)
  }

  // Maps records to their IDs if the record is already cached on JS side
  _compactQueryResults(records: DirtyRaw[], table: TableName<any>): CachedQueryResult {
    const cache = this.getCache(table)
    return records.map(raw => {
      const { id } = raw

      if (cache.has(id)) {
        return id
      }

      cache.add(id)
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

  _warnAboutLackingFTSSupport(columns: Array<ColumnSchema>): void {
    const searchableColumns = columns.filter(column => column.isSearchable)
    if (searchableColumns.length > 0) {
      // Warn the user about missing FTS support for the LokiJS adapter
      // Please contribute! Here are some pointers:
      // https://github.com/LokiJS-Forge/LokiDB/blob/master/packages/full-text-search/spec/generic/full_text_search.spec.ts
      logger.warn('[DB][Worker] LokiJS support for FTS is still to be implemented')
    }
  }

  _assertNotBroken(): void {
    if (this._isBroken) {
      throw new Error('Loki executor is in a broken state, bailing...')
    }
  }

  // (experimental)
  // TODO: Setup, migrations, delete database should also break executor
  _fatalError(error: Error): void {
    if (!experimentalAllowsFatalError) {
      logger.warn('LokiExecutor is broken, but experimentalAllowsFatalError has not been enabled to do anything about it...')
      throw error
    }
    // Stop further mutations
    this._isBroken = true

    // Disable Loki autosave
    lokiFatalError(this.loki)

    // Notify handler
    logger.error('LokiExecutor is broken. App must be reloaded before continuing.')
    const handler = this.options._onFatalError
    handler && handler(error)

    // Rethrow error
    throw error
  }
}
