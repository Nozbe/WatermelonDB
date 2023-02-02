import { Collection, Q, type ColumnName, type TableName } from '@nozbe/watermelondb'

const collection: Collection<any> = null as any
const t: TableName<any> = null as any
const c: ColumnName = null as any

// Check that queries don't break
collection.query()
collection.query(Q.where(c, true))
collection.query(Q.and(Q.where(c, true)))
collection.query(Q.or(Q.where(c, true)))
collection.query(Q.on(t, Q.where(c, true)))

// Same as above, but as an array
collection.query([])
collection.query([Q.where(c, true)])
collection.query(Q.and([Q.where(c, true)]))
collection.query(Q.or([Q.where(c, true)]))
collection.query(Q.on(t, [Q.where(c, true)]))
