// @flow
import type { Observable } from 'rxjs'

import lazy from '../decorators/lazy'
import invariant from '../utils/common/invariant'
import publishReplayLatestWhileConnected from '../utils/rx/publishReplayLatestWhileConnected'

import type Model, { RecordId } from '../Model'
import type { ColumnName, TableName } from '../Schema'

import { createObservable } from './helpers'

type ExtractRecordIdNonOptional = <T: Model>(value: T) => RecordId
type ExtractRecordIdOptional = <T: Model>(value: ?T) => ?RecordId
type ExtractRecordId = ExtractRecordIdNonOptional & ExtractRecordIdOptional

export type Options = $Exact<{
  isImmutable: boolean,
}>

// Defines a one-to-one relation between two Models (two tables in db)
// Do not create this object directly! Use `relation` or `immutableRelation` decorators instead
export default class Relation<T: ?Model> {
  _model: Model

  _columnName: ColumnName

  _relationTableName: TableName<$NonMaybeType<T>>

  _isImmutable: boolean

  @lazy
  _cachedObservable: Observable<T> = createObservable(this)
    .pipe(publishReplayLatestWhileConnected)
    .refCount()

  constructor(
    model: Model,
    relationTableName: TableName<$NonMaybeType<T>>,
    columnName: ColumnName,
    options: Options,
  ): void {
    this._model = model
    this._relationTableName = relationTableName
    this._columnName = columnName
    this._isImmutable = options.isImmutable
  }

  get id(): $Call<ExtractRecordId, T> {
    return (this._model._getRaw(this._columnName): any)
  }

  set id(newId: $Call<ExtractRecordId, T>): void {
    if (this._isImmutable) {
      invariant(
        !this._model._isCommitted,
        `Cannot change property marked as @immutableRelation ${
          Object.getPrototypeOf(this._model).constructor.name
        } - ${this._columnName}`,
      )
    }

    this._model._setRaw(this._columnName, newId || null)
  }

  fetch(): Promise<T> {
    const { id } = this
    if (id) {
      return this._model.collections.get(this._relationTableName).find(id)
    }

    return Promise.resolve((null: any))
  }

  set(record: T): void {
    this.id = record?.id
  }

  observe(): Observable<T> {
    return this._cachedObservable
  }
}
