import type Model from '../../Model'
import Collection from '../../Collection'
import type { TableName } from '../../Schema'
import type Database from '../index'

export default class CollectionMap {
  map: { [tableName: TableName<any>]: Collection<any> }

  constructor(db: Database, modelClasses: Model[])

  get<T extends Model>(tableName: TableName<T>): Collection<T>
}
