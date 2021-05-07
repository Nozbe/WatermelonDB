declare module '@nozbe/watermelondb/Query' {
  import { Collection, ColumnName, Model, TableName } from '@nozbe/watermelondb'
  import { AssociationInfo } from '@nozbe/watermelondb/Model'
  import { Clause, QueryDescription } from '@nozbe/watermelondb/QueryDescription'
  import { Observable } from 'rxjs'

  export type QueryAssociation = { from: TableName<any>; to: TableName<any>; info: AssociationInfo }
  export interface SerializedQuery {
    table: TableName<any>
    description: QueryDescription
    associations: QueryAssociation[]
  }

  export default class Query<Record extends Model> {
    public collection: Collection<Record>

    public description: QueryDescription

    public extend(...conditions: Clause[]): Query<Record>

    public pipe<T>(transform: (this: this) => T): T

    public fetch(): Promise<Record[]>

    public observe(): Observable<Record[]>

    public observeWithColumns(rawFields: ColumnName[]): Observable<Record[]>

    public fetchCount(): Promise<number>

    public observeCount(isThrottled?: boolean): Observable<number>

    public markAllAsDeleted(): Promise<void>

    public destroyAllPermanently(): Promise<void>
  }
}
