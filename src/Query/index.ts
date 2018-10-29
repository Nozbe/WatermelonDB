import { Collection, ColumnName, Model, TableName } from "@nozbe/watermelondb";
import { AssociationInfo } from "@nozbe/watermelondb/Model";
import { Condition, QueryDescription } from "@nozbe/watermelondb/QueryDescription";
import { Observable } from "rxjs";

declare module '@nozbe/watermelondb/Query' {
  export type AssociationArgs = [TableName<any>, AssociationInfo]
  export interface SerializedQuery {
    table: TableName<any>,
    description: QueryDescription,
    associations: AssociationArgs[],
  }

  export default class Query<Record extends Model> {
    public collection: Collection<Record>;

    public description: QueryDescription;

    public extend(...conditions: Condition[]): Query<Record>;

    public pipe<T>(transform: (this: this) => T): T;

    public fetch(): Promise<Record[]>;

    public observe(): Observable<Record[]>;

    public observeWithColumns(rawFields: ColumnName[]): Observable<Record[]>;

    public fetchCount(): Promise<number>;

    public observeCount(isThrottled?: boolean): Observable<number>;

    public markAllAsDeleted(): Promise<void>;

    public destroyAllPermanently(): Promise<void>;
  }
}