import {
  Database, Model, Query, RecordId, TableName, TableSchema,
} from "@nozbe/watermelondb";
import { Condition } from "@nozbe/watermelondb/QueryDescription";
import { Observable, Subject } from "rxjs";

declare module '@nozbe/watermelondb/Collection' {
  export interface CollectionChange<Record extends Model> {
    record: Record,
    isDestroyed: boolean,
  }

  export default class Collection<Record extends Model> {
    public database: Database;

    public modelClass: Class<Record>;

    public changes: Subject<CollectionChange<Record>>;

    public table: TableName<Record>;

    public schema: TableSchema;

    public constructor(database: Database, ModelClass: Class<Record>);

    public find(id: RecordId): Promise<Record>;

    public findAndObserve(id: RecordId): Observable<Record>;

    public query(...conditions: Condition[]): Query<Record>;

    public create(recordBuilder?: (record: Record) => void): Promise<Record>;

    public prepareCreate(recordBuilder?: (record: Record) => void): Record;

    public fetchQuery(query: Query<Record>): Promise<Record[]>;

    public fetchCount(query: Query<Record>): Promise<number>;

    public unsafeClearCache(): void;
  }
}