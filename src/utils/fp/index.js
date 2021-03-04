// @flow

// reexport from rambdax

// TODO: Remove or merge into our codebase all of these
import allPass from 'rambdax/src/rambda/allPass.js'
import anyPass from 'rambdax/src/rambda/anyPass.js'
import equals_SLOW from 'rambdax/src/rambda/equals.js'
import groupBy from 'rambdax/src/rambda/groupBy.js'
import identity from 'rambdax/src/rambda/identity.js'
import keys from 'rambdax/src/rambda/keys.js'
import map from 'rambdax/src/rambda/map.js'
import omit from 'rambdax/src/rambda/omit.js'
import pickAll from 'rambdax/src/rambda/pickAll.js'
import pipe from 'rambdax/src/rambda/pipe.js'
import piped from 'rambdax/src/piped.js'
import promiseAllObject from 'rambdax/src/promiseAllObject.js'
import prop from 'rambdax/src/rambda/prop.js'
import sortBy from 'rambdax/src/rambda/sortBy.js'
import splitEvery from 'rambdax/src/rambda/splitEvery.js'
import uniq_SLOW from 'rambdax/src/rambda/uniq.js'
import values from 'rambdax/src/rambda/values.js'

export {
  allPass,
  anyPass,
  equals_SLOW,
  groupBy,
  identity,
  keys,
  map,
  omit,
  pickAll,
  pipe,
  piped,
  promiseAllObject,
  prop,
  sortBy,
  splitEvery,
  uniq_SLOW,
  values,
}

export { default as allPromises } from './allPromises'
export { default as identicalArrays } from './identicalArrays'
export { default as isObject } from './isObject'
export { default as noop } from './noop'
export { default as withoutIdentical } from './withoutIdentical'
export { default as partition } from './partition'
export { default as differenceWith } from './differenceWith'
export { default as arrayDifference } from './arrayDifference'
export type { ArrayDiff } from './arrayDifference'
export { default as cond } from './cond'
export { default as tryCatch } from './tryCatch'
export { default as is } from './is'
export { default as zip } from './zip'
export { default as identical } from './identical'
export { default as fromPairs } from './fromPairs'
export { default as toPairs } from './toPairs'
export { default as unnest } from './unnest'
