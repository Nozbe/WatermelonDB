// @flow

import type Model from '../Model'
import type Database from '../Database'
import Collection from '../Collection'
import type { TableName } from '../schema'

export default class CollectionMap {
  map: { [TableName<any>]: Collection<any> }

  constructor(database: Database, modelClasses: Class<Model>[]): void {
    this.map = modelClasses.reduce(
      (map, modelClass) => ({
        ...map,
        [(modelClass.table: string)]: new Collection(database, modelClass),
      }),
      {},
    )
  }

  get<T: Model>(tableName: TableName<T>): Collection<T> {
    return this.map[tableName]
  }
}
