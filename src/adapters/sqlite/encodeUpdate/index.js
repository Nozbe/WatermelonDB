// @flow

import type { TableSchema } from '../../../Schema'
import type { RawRecord } from '../../../RawRecord'
import type { SQLiteQuery } from '../index'

const memoizedSqls = new Map()
const generateSql = (schema) => {
  const memoized = memoizedSqls.get(schema)
  if (memoized) {
    return memoized
  }

  // skipping encodeName because performance
  const columns = schema.columnArray
  const placeholders = columns.map((column) => `, "${column.name}" = ?`).join('')
  const sql = `update "${schema.name}" set "_status" = ?, "_changed" = ?${placeholders} where "id" is ?`
  memoizedSqls.set(schema, sql)
  return sql
}

export default function encodeUpdate(tableSchema: TableSchema, raw: RawRecord): SQLiteQuery {
  const sql = generateSql(tableSchema)
  const columns = tableSchema.columnArray
  const len = columns.length

  const args = Array(len + 3)
  args[0] = raw._status
  args[1] = raw._changed
  for (let i = 0; i < len; i++) {
    args[i + 2] = raw[(columns[i].name: any)]
  }
  args[len + 2] = raw.id

  return [sql, args]
}
