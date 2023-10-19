import type { CachedQueryResult } from '../adapters/type'
import type Model from '../Model'
import type { RecordId } from '../Model'
import type { RawRecord } from '../RawRecord'
import type { TableName } from '../Schema'
import type Collection from './index'

type Instantiator<T> = (_: RawRecord) => T

export default class RecordCache<Record extends Model> {
  map: Map<RecordId, Record>

  tableName: TableName<Record>

  recordInsantiator: Instantiator<Record>

  _debugCollection: Collection<Record>

  constructor(
    tableName: TableName<Record>,
    recordInsantiator: Instantiator<Record>,
    collection: Collection<Record>,
  )

  get(id: RecordId): Record | undefined

  add(record: Record): void

  delete(record: Record): void

  unsafeClear(): void

  recordsFromQueryResult(result: CachedQueryResult): Record[]

  recordFromQueryResult(result: RecordId | RawRecord): Record

  _cachedModelForId(id: RecordId): Record

  _modelForRaw(raw: RawRecord): Record
}
