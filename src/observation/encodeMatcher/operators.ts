/* eslint-disable eqeqeq */

import {gt, gte, lt, lte} from '../../utils/fp';
import likeToRegexp from '../../utils/fp/likeToRegexp'

import type { Value, CompoundValue, Operator } from '../../QueryDescription'

type OperatorFunction = (left: Value, right: CompoundValue) => boolean

// @ts-ignore
const between: OperatorFunction = (left: any, [lower, upper]: [any, any]) => left >= lower && left <= upper

export const rawFieldEquals: OperatorFunction = (left: any, right: any) => left == right

const rawFieldNotEquals: OperatorFunction = (left: any, right: any) => !(left == right)

const noNullComparisons: (operator: OperatorFunction) => OperatorFunction = operator => (left: any, right: any) => {
  // return false if any operand is null/undefined
  if (left == null || right == null) {
    return false
  }

  return operator(left, right)
}

// Same as `a > b`, but `5 > undefined` is also true
const weakGt = (left: OperatorFunction, right: OperatorFunction) => left > right || (left != null && right == null)

const handleLikeValue = (v: OperatorFunction, defaultV: string) => (typeof v === 'string' ? v : defaultV)

export const like: OperatorFunction = (left, right) => {
  const leftV = handleLikeValue(left as any, '')

  return likeToRegexp(right as any).test(leftV)
}

export const notLike: OperatorFunction = (left, right) => {
  // Mimic SQLite behaviour
  if (left === null) {
    return false
  }
  const leftV = handleLikeValue(left as any, '')

  return !likeToRegexp(right as any).test(leftV)
}

// @ts-ignore
const oneOf: OperatorFunction = (value, values) => values?.includes(value)
// @ts-ignore
const notOneOf: OperatorFunction = (value, values) => !values?.includes(value)

const operators: Partial<Record<Operator, OperatorFunction>> = {
  eq: rawFieldEquals,
  notEq: rawFieldNotEquals,
  gt: noNullComparisons(gt),
  gte: noNullComparisons(gte),
  // @ts-ignore
  weakGt,
  lt: noNullComparisons(lt),
  lte: noNullComparisons(lte),
  oneOf,
  notIn: noNullComparisons(notOneOf),
  between,
  like,
  notLike,
};

export default operators
