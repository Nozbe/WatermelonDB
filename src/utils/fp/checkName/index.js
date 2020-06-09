// @flow

import invariant from '../../common/invariant'

// Asserts that `name` (table or column name) should be safe for inclusion in SQL queries
// and Loki queries (JS objects)
//
// IMPORTANT: This should NEVER be used as the only line of defense! These checks may be incomplete.
// Any table or column name passed anywhere near the database should be hardcoded or whitelisted.
// This is a "defense in depth" type of check - checking for common mistakes in case library user
// is not following safe coding practices or the primary defense fails.
//
// This will throw an error on:
// - JavaScript Object prototype properties
// - Magic Loki and SQLite column names
// - names starting with __
// - names that are not essentially alphanumeric
//
// Note that for SQL, you always MUST wrap table/column names with `'name'`, otherwise query may fail
// for some keywords
//
// Note that this doesn't throw for Watermelon builtins (id, _changed, _status...)

const safeNameCharacters = /^[a-zA-Z_]\w*$/

export default function checkName(name: string): string {
  invariant(
    ![
      '__proto__',
      'constructor',
      'prototype',
      'hasOwnProperty',
      'isPrototypeOf',
      'toString',
      'toLocaleString',
      'valueOf',
    ].includes(name),
    `Unsafe name '${name}' not allowed (Object prototype property)`,
  )
  invariant(
    name.toLowerCase() !== '$loki',
    `Unsafe name '${name}' not allowed (reserved for LokiJS compatibility)`,
  )
  invariant(
    !['rowid', 'oid', '_rowid_', 'sqlite_master'].includes(name.toLowerCase()),
    `Unsafe name '${name}' not allowed (reserved for SQLite compatibility)`,
  )
  invariant(
    !name.startsWith('__'),
    `Unsafe name '${name}' not allowed (names starting with '__' are reserved for internal purposes)`,
  )
  invariant(
    safeNameCharacters.test(name),
    `Unsafe name '${name}' not allowed (names must contain only safe characters ${safeNameCharacters.toString()})`,
  )
  return name
}
