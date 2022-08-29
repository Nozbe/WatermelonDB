// @flow

import invariant from '../../common/invariant'
import type { TableName, ColumnName } from '../../../Schema'

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

// const safeNameCharacters = /^[a-zA-Z_]\w*$/
// const knownSafeNames: Set<string> = new Set()

export default function checkName<T = string | TableName<any> | ColumnName>(name: T): T
