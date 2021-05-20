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
  const columnsSql = `"id", "_status", "_changed${columns
    .map((column) => `", "${column.name}`)
    .join('')}"`
  const placeholders = Array(columns.length + 3)
    .fill('?')
    .join(', ')
  const sql = `insert into "${schema.name}" (${columnsSql}) values (${placeholders})`
  memoizedSqls.set(schema, sql)
  return sql
}

export default function encodeInsert(tableSchema: TableSchema, raw: RawRecord): SQLiteQuery {
  const sql = generateSql(tableSchema)
  const columns = tableSchema.columnArray
  const len = columns.length

  const args = Array(len + 3)
  args[0] = raw.id
  args[1] = raw._status
  args[2] = raw._changed
  for (let i = 0; i < len; i++) {
    args[i + 3] = raw[(columns[i].name: any)]
  }

  return [sql, args]
}
