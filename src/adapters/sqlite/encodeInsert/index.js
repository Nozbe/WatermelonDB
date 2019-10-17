// @flow

import { pipe, join, keys, values, always, map } from 'rambdax'

import type { TableName } from '../../../Schema'
import type { RawRecord } from '../../../RawRecord'
import type { SQLiteQuery } from '../index'

import encodeName from '../encodeName'

const columnNames = pipe(
  keys,
  map(encodeName),
  join(', '),
)

const valuePlaceholders = pipe(
  values,
  map(always('?')),
  join(', '),
)

export default function encodeInsert(table: TableName<any>, raw: RawRecord): SQLiteQuery {
  const sql = `insert into ${table} (${columnNames(raw)}) values (${valuePlaceholders(raw)})`
  const args = values(raw)

  return [sql, args]
}
