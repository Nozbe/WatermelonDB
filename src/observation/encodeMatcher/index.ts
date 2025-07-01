/* eslint-disable no-use-before-define */

import {pipe, map, allPass, anyPass} from 'rambdax';

import invariant from '../../utils/common/invariant'

import type { QueryDescription, WhereDescription, Where } from '../../QueryDescription'
import type { RawRecord } from '../../RawRecord'
import type Model from '../../Model'

import operators from './operators'
import canEncodeMatcher, { forbiddenError } from './canEncode'

// eslint-disable-next-line no-unused-vars
export type Matcher<Element extends Model> = (arg1: RawRecord) => boolean;

// @ts-ignore
const encodeWhereDescription: (arg1: WhereDescription) => Matcher<any> = description => (rawRecord: RawRecord) => {
  const left = (rawRecord as any)[description.left]
  const { comparison } = description
  const operator = operators[comparison.operator]

  const compRight = comparison.right as any
  let right

  // TODO: What about `undefined`s ?
  if (compRight.value !== undefined) {
    right = compRight.value
  } else if (compRight.values) {
    right = compRight.values
  } else if (compRight.column) {
    right = (rawRecord as any)[compRight.column]
  } else {
    throw new Error('Invalid comparisonRight')
  }

  return operator?.(left, right)
}

const encodeWhere: (arg1: Where) => Matcher<any> = where => {
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

const encodeConditions: (arg1: Where[]) => Matcher<any> = pipe(
  // @ts-ignore
  map(encodeWhere),
  allPass,
)

export default function encodeMatcher<Element extends Model>(query: QueryDescription): Matcher<Element> {
  invariant(canEncodeMatcher(query), forbiddenError)

  return encodeConditions(query.where) as any;
}
