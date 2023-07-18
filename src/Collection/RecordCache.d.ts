declare module '@BuildHero/watermelondb/Collection/RecordCache' {
  import { Model, RawRecord, RecordId, TableName } from '@BuildHero/watermelondb'
  import { CachedQueryResult } from '@BuildHero/watermelondb/adapters/type'

  type Instantiator<T> = (raw: RawRecord) => T

  export default class RecordCache<Record extends Model> {
    public map: Map<RecordId, Record>

    public tableName: TableName<Record>

    public recordInsantiator: Instantiator<Record>

    public constructor(tableName: TableName<Record>, recordInsantiator: Instantiator<Record>)

    public get(id: RecordId): Record | void

    public add(record: Record): void

    public delete(record: Record): void

    public unsafeClear(): void

    public recordsFromQueryResult(result: CachedQueryResult): Record[]

    public recordFromQueryResult(result: RecordId | RawRecord): Record
  }
}
