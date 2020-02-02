// @flow

import logError from '../utils/common/logError'
import invariant from '../utils/common/invariant'

import type Model, { RecordId } from '../Model'
import type { CachedQueryResult } from '../adapters/type'
import type { TableName, ColumnName } from '../Schema'
import type { RawRecord, RecordState } from '../RawRecord'
import { getRecordState } from '../RawRecord'

type Instantiator<T> = RawRecord => T

export default class RecordCache<Record: Model> {
  map: Map<RecordId, Record> = new Map()

  tableName: TableName<Record>

  recordInsantiator: Instantiator<Record>

  constructor(tableName: TableName<Record>, recordInsantiator: Instantiator<Record>): void {
    this.tableName = tableName
    this.recordInsantiator = recordInsantiator
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

  recordStatesFromQueryResult(result: CachedQueryResult, columns: ColumnName[]): RecordState[] {
    return result.map(res => this.recordStateFromQueryResult(res, columns))
  }

  recordStateFromQueryResult(result: RecordId | RawRecord, columns: ColumnName[]): RecordState {
    let rawRecord = result
    if (typeof rawRecord === 'string') {
      rawRecord = this._cachedModelForId(rawRecord)._raw
    }
    return getRecordState(rawRecord, columns)
  }

  _cachedModelForId(id: RecordId): Record {
    const record = this.map.get(id)

    invariant(
      record,
      `Record ID ${this.tableName}#${id} was sent over the bridge, but it's not cached`,
    )

    return record
  }

  _modelForRaw(raw: RawRecord): Record {
    // Sanity check: is this already cached?
    const cachedRecord = this.map.get(raw.id)

    if (cachedRecord) {
      logError(
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
