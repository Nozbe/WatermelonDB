declare module '@nozbe/watermelondb/Query' {
  import { Collection, ColumnName, Model, TableName } from "@nozbe/watermelondb";
  import { AssociationInfo } from "@nozbe/watermelondb/Model";
  import { Condition, QueryDescription } from "@nozbe/watermelondb/QueryDescription";
  import { Observable } from "rxjs";

  export type AssociationArgs = [TableName<any>, AssociationInfo]
  export type SerializedQuery = {
    table: TableName<any>,
    description: QueryDescription,
    associations: AssociationArgs[],
  }

  export default class Query<Record extends Model> {
    collection: Collection<Record>;

    description: QueryDescription;

    extend(...conditions: Condition[]): Query<Record>;

    pipe<T>(transform: (this: this) => T): T;

    fetch(): Promise<Record[]>;

    observe(): Observable<Record[]>;

    observeWithColumns(rawFields: ColumnName[]): Observable<Record[]>;

    fetchCount(): Promise<number>;

    observeCount(isThrottled?: boolean): Observable<number>;

    markAllAsDeleted(): Promise<void>;

    destroyAllPermanently(): Promise<void>;
  }
}