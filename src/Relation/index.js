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
  #model: Model

  #columnName: ColumnName

  #relationTableName: TableName<$NonMaybeType<T>>

  #isImmutable: boolean

  get _model(): Model {
    return this.#model
  }

  get _columnName(): ColumnName {
    return this.#columnName
  }

  get _relationTableName(): TableName<$NonMaybeType<T>> {
    return this.#relationTableName
  }

  get _isImmutable(): boolean {
    return this.#isImmutable
  }

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
    this.#model = model
    this.#relationTableName = relationTableName
    this.#columnName = columnName
    this.#isImmutable = options.isImmutable
  }

  get id(): $Call<ExtractRecordId, T> {
    return (this.#model._getRaw(this.#columnName): any)
  }

  set id(newId: $Call<ExtractRecordId, T>): void {
    if (this.#isImmutable) {
      invariant(
        !this.#model._isCommitted,
        `Cannot change property marked as @immutableRelation ${
          Object.getPrototypeOf(this.#model).constructor.name
        } - ${this.#columnName}`,
      )
    }

    this.#model._setRaw(this.#columnName, newId || null)
  }

  fetch(): Promise<T> {
    const { id } = this
    if (id) {
      return this.#model.collections.get(this.#relationTableName).find(id)
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
