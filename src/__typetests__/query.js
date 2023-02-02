// @flow
import { Collection, Q, type ColumnName, type TableName } from '../index'

const collection: Collection<*> = (null: any)
const t: TableName<*> = (null: any)
const c: ColumnName = (null: any)

// Check that queries don't break
collection.query()
collection.query(Q.where(c, true))
collection.query(Q.and(Q.where(c, true)))
collection.query(Q.or(Q.where(c, true)))
collection.query(Q.on(t, Q.where(c, true)))
