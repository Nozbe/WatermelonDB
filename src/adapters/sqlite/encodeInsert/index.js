// @flow

import type { TableName } from '../../../Schema'
import type { RawRecord } from '../../../RawRecord'
import type { SQLiteQuery, SQLiteArg } from '../index'

const memoizedPlaceholders = {}
const generatePlaceholders = (count) => {
  const memoized = memoizedPlaceholders[count]
  if (memoized) {
    return memoized
  }

  const placeholders = Array(count).fill('?').join(', ')
  memoizedPlaceholders[count] = placeholders
  return placeholders
}

export default function encodeInsert(table: TableName<any>, raw: RawRecord): SQLiteQuery {
  const keys = Object.keys(raw)

  // skipping encodeName because performance
  const sql = `insert into "${table}" ("${keys.join('", "')}") values (${generatePlaceholders(
    keys.length,
  )})`
  const args: SQLiteArg[] = (Object.values(raw): any)

  return [sql, args]
}
