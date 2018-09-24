declare module '@nozbe/watermelondb/Collection/RecordCache' {
  import { Model, RawRecord, RecordId, TableName } from "@nozbe/watermelondb";
  import { CachedQueryResult } from "@nozbe/watermelondb/adapters/type";

  type Instantiator<T> = (raw: RawRecord) => T;

  export default class RecordCache<Record extends Model> {
    map: Map<RecordId, Record>;

    tableName: TableName<Record>;

    recordInsantiator: Instantiator<Record>;

    constructor(tableName: TableName<Record>, recordInsantiator: Instantiator<Record>);

    get(id: RecordId): Record | void;

    add(record: Record): void;

    delete(record: Record): void;

    unsafeClear(): void;

    recordsFromQueryResult(result: CachedQueryResult): Record[];

    recordFromQueryResult(result: RecordId | RawRecord): Record;
  }
}