import logError from '../utils/common/logError';
import invariant from '../utils/common/invariant'

import type Model from '../Model'
import type { RecordId } from '../Model'
import type { CachedQueryResult } from '../adapters/type'
import type { TableName } from '../Schema'
import type { RawRecord } from '../RawRecord'

type Instantiator<T> = (arg1: RawRecord) => T;

export default class RecordCache<Record extends Model> {
  map: Map<RecordId, Record> = new Map();

  tableName: TableName<Record>;

  recordInsantiator: Instantiator<Record>;

  queryFunc: (arg1: RecordId) => void;

  constructor(
    tableName: TableName<Record>,
    recordInsantiator: Instantiator<Record>,
    queryFunc: (arg1: RecordId) => void,
  ) {
    this.tableName = tableName
    this.recordInsantiator = recordInsantiator
    this.queryFunc = queryFunc;
  }

  get(id: RecordId): Record | null | undefined {
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

  recordsFromQueryResult(result: CachedQueryResult): (Record | null | undefined)[] {
    return result.map(res => this.recordFromQueryResult(res))
  }

  recordFromQueryResult(result: RecordId | RawRecord): Record | null | undefined {
    if (typeof result === 'string') {
      return this._cachedModelForId(result)
    }

    return this._modelForRaw(result)
  }

  _cachedModelForId(id: RecordId): Record | null | undefined {
    const record = this.map.get(id)

    if (!record && !this.queryFunc) {
      invariant(
        record,
        `Record ID ${this.tableName}#${id} was sent over the bridge, but it's not cached`,
      )
    }

    if (!record && this.queryFunc) {
      const data = this.queryFunc(id) as any;

      if (!data) {
        logError(`Record ID ${this.tableName}#${id} was sent over the bridge, but not found`)

        return null;
      }

      return this._modelForRaw(data)
    }

    return record;
  }

  _modelForRaw(raw: RawRecord): Record {
    // Sanity check: is this already cached?
    const cachedRecord = this.map.get(raw.id)

    if (cachedRecord) {
      logError(
        `Record ${this.tableName}#${cachedRecord.id} is cached, but full raw object was sent over the bridge`,
      )
      return cachedRecord
    }

    // Return new model
    const newRecord = this.recordInsantiator(raw)
    this.add(newRecord)
    return newRecord
  }
}
