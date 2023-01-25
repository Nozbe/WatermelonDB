// @flow
/* eslint-disable eqeqeq */

import likeToRegexp from '../../utils/fp/likeToRegexp'

import type { Value, CompoundValue, Operator } from '../../QueryDescription'

type OperatorFunction = $FlowFixMe<(Value, CompoundValue) => boolean>

const between: OperatorFunction = (left, [lower, upper]) => left >= lower && left <= upper

export const rawFieldEquals: OperatorFunction = (left, right) => left == right

const rawFieldNotEquals: OperatorFunction = (left, right) => !(left == right)

const noNullComparisons: (OperatorFunction) => OperatorFunction = (operator) => (left, right) => {
  // return false if any operand is null/undefined
  if (left == null || right == null) {
    return false
  }

  return operator(left, right)
}

// Same as `a > b`, but `5 > undefined` is also true
const weakGt = (left, right) => left > right || (left != null && right == null)

const handleLikeValue = (v, defaultV: string) => (typeof v === 'string' ? v : defaultV)

export const like: OperatorFunction = (left, right) => {
  const leftV = handleLikeValue(left, '')

  return likeToRegexp(right).test(leftV)
}

export const notLike: OperatorFunction = (left, right) => {
  // Mimic SQLite behaviour
  if (left === null) {
    return false
  }
  const leftV = handleLikeValue(left, '')

  return !likeToRegexp(right).test(leftV)
}

const oneOf: OperatorFunction = (value, values) => values.includes(value)
const notOneOf: OperatorFunction = (value, values) => !values.includes(value)

const gt = (a, b: any) => a > b
const gte = (a, b: any) => a >= b
const lt = (a, b: any) => a < b
const lte = (a, b: any) => a <= b
const includes = (a, b: any) => typeof a === 'string' && a.includes(b)

const operators: { [Operator]: OperatorFunction } = {
  eq: rawFieldEquals,
  notEq: rawFieldNotEquals,
  gt: noNullComparisons(gt),
  gte: noNullComparisons(gte),
  weakGt,
  lt: noNullComparisons(lt),
  lte: noNullComparisons(lte),
  oneOf,
  notIn: noNullComparisons(notOneOf),
  between,
  like,
  notLike,
  includes,
}

export default operators
