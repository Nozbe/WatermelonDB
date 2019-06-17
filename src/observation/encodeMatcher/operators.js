// @flow
/* eslint-disable eqeqeq */

import { contains } from 'rambdax'
import { gt, gte, lt, lte, complement } from '../../utils/fp'
import likeToRegexp from '../../utils/fp/likeToRegexp'

import type { Value, CompoundValue, Operator } from '../../QueryDescription'

type OperatorFunction = $FlowFixMe<(Value, CompoundValue) => boolean>

const between: OperatorFunction = (left, [lower, upper]) => left >= lower && left <= upper

export const rawFieldEquals: OperatorFunction = (left, right) => left == right

const noNullComparisons: OperatorFunction => OperatorFunction = operator => (left, right) => {
  // return false if any operand is null/undefined
  if (left == null || right == null) {
    return false
  }

  return operator(left, right)
}

// Same as `a > b`, but `5 > undefined` is also true
const weakGt = (left, right) => left > right || (left != null && right == null)

const handleLikeValue = (v, defaultV) => (typeof v === 'string' ? v : defaultV)

export const like: OperatorFunction = (left, right) => {
  const leftV = handleLikeValue(left, '')

  return likeToRegexp(right).test(leftV)
}

const operators: { [Operator]: OperatorFunction } = {
  eq: rawFieldEquals,
  notEq: complement(rawFieldEquals),
  gt: noNullComparisons(gt),
  gte: noNullComparisons(gte),
  weakGt,
  lt: noNullComparisons(lt),
  lte: noNullComparisons(lte),
  oneOf: contains,
  notIn: noNullComparisons(complement(contains)),
  between,
  like,
}

export default operators
