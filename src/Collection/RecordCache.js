// @flow

import logger from '../utils/common/logger'

import type Model, { RecordId } from '../Model'
import type Collection from './index'
import type { CachedQueryResult } from '../adapters/type'
import type { TableName } from '../Schema'
import type { RawRecord } from '../RawRecord'

type Instantiator<T> = RawRecord => T

export default class RecordCache<Record: Model> {
  map: Map<RecordId, Record> = new Map()

  tableName: TableName<Record>

  recordInsantiator: Instantiator<Record>

  _debugCollection: Collection<Record>

  constructor(
    tableName: TableName<Record>,
    recordInsantiator: Instantiator<Record>,
    collection: Collection<Record>,
  ): void {
    this.tableName = tableName
    this.recordInsantiator = recordInsantiator
    this._debugCollection = collection
  }

  get(id: RecordId): ?Record {
    return this.map.get(id)
  }

  add(record: Record): void {
    this.map.set(record.id, record)
  }

  delete(record: Record): void {
    this.map.delete(record.id)
  }

  unsafeClear(): void {
    this.map = new Map()
  }

  recordsFromQueryResult(result: CachedQueryResult): Record[] {
    return result.map(res => this.recordFromQueryResult(res))
  }

  recordFromQueryResult(result: RecordId | RawRecord): Record {
    if (typeof result === 'string') {
      return this._cachedModelForId(result)
    }

    return this._modelForRaw(result)
  }

  _cachedModelForId(id: RecordId): Record {
    const record = this.map.get(id)

    if (!record) {
      const message = `Record ID ${this.tableName}#${id} was sent over the bridge, but it's not cached`
      logger.error(message)

      // Reaching this branch indicates a WatermelonDB/adapter bug. We should never get a record ID
      // if we don't have it in our cache. This probably means that something crashed when adding to
      // adapter-side cached record ID set. NozbeTeams telemetry indicates that this bug *does*
      // nonetheless occur, so when it does, print out useful diagnostics and attempt to recover by
      // resetting adapter-side cached set
      try {
        const adapter = this._debugCollection.database.adapter.underlyingAdapter

        // $FlowFixMe
        if (adapter._clearCachedRecords) {
          // $FlowFixMe
          adapter._clearCachedRecords()
        }

        // $FlowFixMe
        if (adapter._debugDignoseMissingRecord) {
          // $FlowFixMe
          adapter._debugDignoseMissingRecord(this.tableName, id)
        }
      } catch (error) {
        logger.warn(`Ran into an error while running diagnostics:`)
        logger.warn(error)
      }

      throw new Error(message)
    }

    return record
  }

  _modelForRaw(raw: RawRecord): Record {
    // Sanity check: is this already cached?
    const cachedRecord = this.map.get(raw.id)

    if (cachedRecord) {
      // This may legitimately happen if we previously got ID without a record and we cleared
      // adapter-side cached record ID maps to recover
      logger.warn(
        `Record ${this.tableName}#${
          cachedRecord.id
        } is cached, but full raw object was sent over the bridge`,
      )
      return cachedRecord
    }

    // Return new model
    const newRecord = this.recordInsantiator(raw)
    this.add(newRecord)
    return newRecord
  }
}
