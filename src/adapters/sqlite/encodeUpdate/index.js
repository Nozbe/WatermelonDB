// @flow

import { pipe, map, join, keys, values, append } from 'rambdax'

import type { TableName } from '../../../Schema'
import type { RawRecord } from '../../../RawRecord'
import type { SQL, SQLiteQuery, SQLiteArg } from '../index'

import encodeName from '../encodeName'

const encodeSetPlaceholders: RawRecord => SQL = pipe(
  keys,
  map(encodeName),
  map(key => `${key}=?`),
  join(', '),
)

const getArgs: RawRecord => SQLiteArg[] = raw =>
  // $FlowFixMe
  pipe(
    values,
    append(raw.id), // for `where id is ?`
  )(raw)

export default function encodeUpdate(table: TableName<any>, raw: RawRecord): SQLiteQuery {
  const sql = `update ${encodeName(table)} set ${encodeSetPlaceholders(raw)} where "id" is ?`
  const args = getArgs(raw)

  return [sql, args]
}
