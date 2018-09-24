declare module '@nozbe/watermelondb/Collection' {
  import { Database, Model, Query, RecordId, TableName, TableSchema } from "@nozbe/watermelondb";
  import { Condition } from "@nozbe/watermelondb/QueryDescription";
  import { Observable, Subject } from "rxjs";

  export type CollectionChange<Record extends Model> = {
    record: Record,
    isDestroyed: boolean,
  }

  export default class Collection<Record extends Model> {
    database: Database;

    modelClass: Class<Record>;

    changes: Subject<CollectionChange<Record>>;

    constructor(database: Database, ModelClass: Class<Record>);

    find(id: RecordId): Promise<Record>;

    findAndObserve(id: RecordId): Observable<Record>;

    query(...conditions: Condition[]): Query<Record>;

    create(recordBuilder?: (record: Record) => void): Promise<Record>;

    prepareCreate(recordBuilder?: (record: Record) => void): Record;

    fetchQuery(query: Query<Record>): Promise<Record[]>;

    fetchCount(query: Query<Record>): Promise<number>;

    table: TableName<Record>;

    schema: TableSchema;

    unsafeClearCache(): void;
  }
}