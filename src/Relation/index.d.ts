declare module '@nozbe/watermelondb/Relation' {
  import { ColumnName, Model, RecordId, TableName } from '@nozbe/watermelondb'
  import { Observable } from 'rxjs'
  import { $Call } from '@nozbe/watermelondb/utils/common'

  export interface Options {
    isImmutable: boolean
  }

  export default class Relation<T extends Model> {
    public constructor(
      model: Model,
      relationTableName: TableName<T>,
      columnName: ColumnName,
      options: Options,
    )

    public id: $Call<(value: T | void) => RecordId | void>

    public fetch(): Promise<T | null>

    public set(record: T | null): void

    public observe(): Observable<T | null>
  }
}
