// @flow
import Query from '.'
import type Collection from '../Collection'
import type Model from '../Model'

export default class RawQuery<Record: Model> extends Query<Record> {
  sql: string

  constructor(collection: Collection<Record>, sql: string): void {
    super(collection, [])
    this.sql = sql
  }

  fetch(): Promise<Record[]> {
    return this.collection.fetchRawQuery(this)
  }
}
