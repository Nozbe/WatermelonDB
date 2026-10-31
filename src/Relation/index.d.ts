import { $Exact, $Call } from '../types'
import type { Observable } from '../utils/rx'

import type Model from '../Model'
import type { RecordId } from '../Model'
import type { ColumnName, TableName } from '../Schema'

type ExtractRecordIdNonOptional = <T extends Model = Model>(value: T) => RecordId
type ExtractRecordIdOptional = <T extends Model = Model>(value: T) => RecordId
type ExtractRecordId = ExtractRecordIdNonOptional & ExtractRecordIdOptional

export type Options = $Exact<{
  isImmutable: boolean
  // If true, observing a related record that does not exist emits `null` (and recovers once the
  // record is created) instead of erroring. See `Collection.observeRecord` and `@experimentalFailsafe`
  failsafe?: boolean
}>

// Defines a one-to-one relation between two Models (two tables in db)
// Do not create this object directly! Use `relation` or `immutableRelation` decorators instead
//
// Use a nullable type (e.g. `Relation<Comment | null>`) if the relation ID is optional, or if the
// relation is marked with `@experimentalFailsafe` (`Relation<Comment | undefined>` by default)
export default class Relation<T extends Model | null | undefined> {
  // Used by withObservables to differentiate between object types
  static _wmelonTag: string

  _model: Model

  _columnName: ColumnName

  _relationTableName: TableName<NonNullable<T>>

  _isImmutable: boolean

  _isFailsafe: boolean

  // TODO: FIX TS
  // @lazy
  _cachedObservable: Observable<T>

  constructor(
    model: Model,
    relationTableName: TableName<NonNullable<T>>,
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
