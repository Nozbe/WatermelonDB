// @flow

import { pipe, map, join, keys, values, append } from 'rambdax'

import type Model from 'Model'
import { type RawRecord } from 'RawRecord'
import type { SQL, SQLiteQuery, SQLiteArg } from '../index'

const encodeSetPlaceholders: RawRecord => SQL = pipe(
  keys,
  map(key => `${key}=?`),
  join(', '),
)

const getArgs: RawRecord => SQLiteArg[] = raw =>
  pipe(
    values,
    append(raw.id), // for `where id is ?`
  )(raw)

export default function encodeUpdate(model: Model): SQLiteQuery {
  const { _raw: raw, table } = model
  const sql = `update ${table} set ${encodeSetPlaceholders(raw)} where id is ?`
  const args = getArgs(raw)

  return [sql, args]
}
