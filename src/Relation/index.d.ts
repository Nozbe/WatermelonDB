import { $NonMaybeType, $Exact, $Call } from '../types';
import type { Observable } from '../utils/rx'

import type Model from '../Model'
import type { RecordId } from '../Model'
import type { ColumnName, TableName } from '../Schema'

type ExtractRecordIdNonOptional = <T = Model>(value: T) => RecordId
type ExtractRecordIdOptional = <T = Model>(value: T) => RecordId
type ExtractRecordId = ExtractRecordIdNonOptional & ExtractRecordIdOptional

export type Options = $Exact<{
  isImmutable: boolean,
}>

// Defines a one-to-one relation between two Models (two tables in db)
// Do not create this object directly! Use `relation` or `immutableRelation` decorators instead
export default class Relation<T extends Model> {
  // Used by withObservables to differentiate between object types
  static _wmelonTag: string

  _model: Model

  _columnName: ColumnName

  _relationTableName: TableName<$NonMaybeType<T>>

  _isImmutable: boolean

  // TODO: FIX TS
  // @lazy
  _cachedObservable: Observable<T>

  constructor(
    model: Model,
    relationTableName: TableName<$NonMaybeType<T>>,
    columnName: ColumnName,
    options: Options,
  )

  get id(): $Call<ExtractRecordId, T>

  set id(newId: $Call<ExtractRecordId, T>)

  fetch(): Promise<T>

  then<U>(
    onFulfill?: (value: T) => Promise<U> | U,
    onReject?: (error: any) => Promise<U> | U,
  ): Promise<U>

  set(record: T): void

  observe(): Observable<T>
}
