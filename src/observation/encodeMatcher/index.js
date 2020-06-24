// @flow
/* eslint-disable no-use-before-define */

import { pipe, map, allPass, anyPass } from 'rambdax'

import invariant from '../../utils/common/invariant'

import type { QueryDescription, WhereDescription, Where } from '../../QueryDescription'
import type { RawRecord } from '../../RawRecord'
import type Model from '../../Model'

import operators from './operators'

// eslint-disable-next-line no-unused-vars
export type Matcher<Element: Model> = RawRecord => boolean

const encodeWhereDescription: WhereDescription => Matcher<*> = description => rawRecord => {
  const left = (rawRecord: Object)[description.left]
  const { comparison } = description
  const operator = operators[comparison.operator]

  const compRight = comparison.right
  let right

  // TODO: What about `undefined`s ?
  if (compRight.value !== undefined) {
    right = compRight.value
  } else if (compRight.values) {
    right = compRight.values
  } else if (compRight.column) {
    right = (rawRecord: Object)[compRight.column]
  } else {
    throw new Error('Invalid comparisonRight')
  }

  return operator(left, right)
}

const encodeWhere: Where => Matcher<*> = where => {
  switch (where.type) {
    case 'where':
      return encodeWhereDescription(where)
    case 'and':
      return allPass(where.conditions.map(encodeWhere))
    case 'or':
      return anyPass(where.conditions.map(encodeWhere))
    case 'on':
      throw new Error(
        'Illegal Q.on found -- nested Q.ons require explicit Q.experimentalJoinTables declaration',
      )
    default:
      throw new Error(`Illegal clause ${where.type}`)
  }
}

const encodeConditions: (Where[]) => Matcher<*> = pipe(
  map(encodeWhere),
  allPass,
)

export default function encodeMatcher<Element: Model>(query: QueryDescription): Matcher<Element> {
  const { joinTables, nestedJoinTables, sortBy, take, skip, where } = query

  invariant(
    !joinTables.length && !nestedJoinTables.length && !sortBy.length && !take && !skip,
    `Queries with joins, sortBy, take, or skip can't be encoded into a matcher`,
  )

  return (encodeConditions(where): any)
}
