// @flow
/* eslint-disable no-use-before-define */

import { pipe, map, prop, allPass, anyPass, has, propEq } from 'rambdax'

// don't import whole `utils` to keep worker size small
import cond from 'utils/fp/cond'
import invariant from 'utils/common/invariant'

import type {
  QueryDescription,
  CompoundValue,
  WhereDescription,
  And,
  Or,
  Where,
  ComparisonRight,
} from 'QueryDescription'
import type Model from 'Model'

import operators from './operators'

export type Matcher<Element: Model> = Element => boolean

const getComparisonRightFor: Model => (
  $FlowFixMe<ComparisonRight>,
) => $FlowFixMe<CompoundValue> = element =>
  cond([
    [has('value'), prop('value')],
    [has('values'), prop('values')],
    [has('column'), arg => element._raw[arg.column]],
  ])

const encodeWhereDescription: WhereDescription => Matcher<*> = description => element => {
  const left = element._raw[description.left]
  const { comparison } = description
  const operator = operators[comparison.operator]
  const getRight = getComparisonRightFor(element)
  const right = getRight(comparison.right)

  return operator(left, right)
}

const typeEq = propEq('type')

const encodeWhere: Where => Matcher<*> = where =>
  (cond([
    [typeEq('and'), encodeAnd],
    [typeEq('or'), encodeOr],
    [typeEq('where'), encodeWhereDescription],
  ]): any)(where)

const encodeAnd: And => Matcher<*> = pipe(
  prop('conditions'),
  map(encodeWhere),
  allPass,
)

const encodeOr: Or => Matcher<*> = pipe(
  prop('conditions'),
  map(encodeWhere),
  anyPass,
)

const encodeConditions: (Where[]) => Matcher<*> = pipe(
  map(encodeWhere),
  allPass,
)

export default function encodeMatcher<Element: Model>(query: QueryDescription): Matcher<Element> {
  const { join, where } = query

  invariant(!join.length, `Queries with joins can't be encoded into a matcher`)

  return (encodeConditions(where): any)
}
