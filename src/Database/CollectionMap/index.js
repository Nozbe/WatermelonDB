// @flow

import type Model from '../../Model'
import Collection from '../../Collection'
import type { TableName } from '../../Schema'
import type Database from '../index'

import { invariant } from '../../utils/common'

export default class CollectionMap {
  map: { [TableName<any>]: Collection<any> }

  constructor(db: Database, modelClasses: Class<Model>[]): void {
    this.map = (Object.create(null): any)
    modelClasses.forEach((modelClass) => {
      const { table } = modelClass
      if (process.env.NODE_ENV !== 'production') {
        // TODO: move these checks to Collection?
        invariant(
          typeof table === 'string',
          `Model class ${modelClass.name} passed to Database constructor is missing "static table = 'table_name'"`,
        )
        invariant(
          db.schema.tables[table],
          `Model class ${modelClass.name} has static table defined that is missing in schema known by this database`,
        )
      }
      this.map[table] = new Collection(db, modelClass)
    })
    Object.freeze(this.map)
  }

  get<T: Model>(tableName: TableName<T>): Collection<T> {
    return (this.map[tableName] || null: any)
  }
}
