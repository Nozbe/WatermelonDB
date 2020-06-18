declare module '@nozbe/watermelondb/Collection' {
  import { Database, Model, Query, RecordId, TableName, TableSchema } from '@nozbe/watermelondb'
  import { Clause } from '@nozbe/watermelondb/QueryDescription'
  import { Class } from '@nozbe/watermelondb/utils/common'
  import { Observable, Subject } from 'rxjs'

  export interface CollectionChange<Record extends Model> {
    record: Record
    isDestroyed: boolean
  }

  export type CollectionChangeSet<Record extends Model> = CollectionChange<Record>[]

  export default class Collection<Record extends Model> {
    public database: Database

    public modelClass: Class<Record>

    public changes: Subject<CollectionChangeSet<Record>>

    public table: TableName<Record>

    public schema: TableSchema

    public constructor(database: Database, ModelClass: Class<Record>)

    public find(id: RecordId): Promise<Record>

    public findAndObserve(id: RecordId): Observable<Record>

    public query(...conditions: Clause[]): Query<Record>

    public unsafeFetchRecordsWithSQL(sql: string): Promise<Record[]>

    public create(recordBuilder?: (record: Record) => void): Promise<Record>

    public prepareCreate(recordBuilder?: (record: Record) => void): Record

    public fetchQuery(query: Query<Record>): Promise<Record[]>

    public fetchCount(query: Query<Record>): Promise<number>

    public unsafeClearCache(): void
  }
}
