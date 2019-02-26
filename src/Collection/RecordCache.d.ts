declare module '@nozbe/watermelondb/Collection/RecordCache' {
  import { Model, RawRecord, RecordId, TableName } from "@nozbe/watermelondb";
  import { CachedQueryResult } from "@nozbe/watermelondb/adapters/type";

  type Instantiator<T> = (raw: RawRecord) => T;

  export default class RecordCache<Record extends Model> {
    public map: Map<RecordId, Record>;

    public tableName: TableName<Record>;

    public recordInsantiator: Instantiator<Record>;

    public constructor(tableName: TableName<Record>, recordInsantiator: Instantiator<Record>);

    public get(id: RecordId): Record | void;

    public add(record: Record): void;

    public delete(record: Record): void;

    public unsafeClear(): void;

    public recordsFromQueryResult(result: CachedQueryResult): Record[];

    public recordFromQueryResult(result: RecordId | RawRecord): Record;
  }
}