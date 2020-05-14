declare module '@nozbe/watermelondb/Relation' {
  import { ColumnName, Model, RecordId, TableName } from '@nozbe/watermelondb'
  import { Observable } from 'rxjs'
  import { $Call } from '@nozbe/watermelondb/utils/common'

  type ExtractRecordIdNonOptional<T extends Model> = (value: T) => RecordId
  type ExtractRecordIdOptional<T extends Model> = (value: T | void) => RecordId | void
  type ExtractRecordId<T extends Model> = ExtractRecordIdNonOptional<T> & ExtractRecordIdOptional<T>


  type RecordNonOptional<T extends Model> =  T
  type RecordOptional<T extends Model> =  T | null
  type Record<T extends Model> = RecordNonOptional<T> | RecordOptional<T>

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

    public id: $Call<ExtractRecordId<T>>

    public fetch(): Promise<Record<T>>

    public set(record: Record<T>): void

    public observe(): Observable<Record<T>>
  }
}
