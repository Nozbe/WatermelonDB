import type {Observable} from '../utils/rx';
import invariant from '../utils/common/invariant'
import publishReplayLatestWhileConnected from '../utils/rx/publishReplayLatestWhileConnected'
import lazy from '../decorators/lazy'
import type Model from '../Model'
import type { RecordId } from '../Model'
import type { ColumnName, TableName } from '../Schema'

import { createObservable } from './helpers'

type ExtractRecordIdNonOptional = <T extends Model>(value: T) => RecordId;
type ExtractRecordIdOptional = <T extends Model>(value?: T | null | undefined) => RecordId | null | undefined;
type ExtractRecordId = ExtractRecordIdNonOptional & ExtractRecordIdOptional;

export type Options = {
  isImmutable: boolean;
};

// Defines a one-to-one relation between two Models (two tables in db)
// Do not create this object directly! Use `relation` or `immutableRelation` decorators instead
export default class Relation<T extends Model | null | undefined> {
  _model: Model;

  _columnName: ColumnName;

  _relationTableName: TableName<NonNullable<T>>;

  _isImmutable: boolean;

  // @ts-ignore
  @lazy
  _cachedObservable: Observable<T> = createObservable(this)
    .pipe(publishReplayLatestWhileConnected)
    // @ts-ignore
    .refCount();

  constructor(
    model: Model,
    relationTableName: TableName<NonNullable<T>>,
    columnName: ColumnName,
    options: Options,
  ) {
    this._model = model
    this._relationTableName = relationTableName
    this._columnName = columnName
    this._isImmutable = options.isImmutable
  }

  get id(): ReturnType<ExtractRecordId> {
    return this._model._getRaw(this._columnName) as any;
  }

  set id(newId: ReturnType<ExtractRecordId>) {
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

  fetch(): Promise<T|Model> {
    const { id } = this
    if (id) {
      return this._model.collections.get(this._relationTableName).find(id)
    }

    return Promise.resolve((null as any));
  }

  then<U>(
    onFulfill?: (value: T) => Promise<U> | U,
    onReject?: (error?: any) => Promise<U> | U,
  ): Promise<U> {
    // @ts-ignore
    return this.fetch().then(onFulfill, onReject);
  }

  set(record: T): void {
    this.id = record?.id
  }

  observe(): Observable<T> {
    return this._cachedObservable
  }
}
