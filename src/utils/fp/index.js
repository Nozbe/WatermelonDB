// @flow

// reexport from rambdax

// TODO: Remove or merge into our codebase all of these
import allPass from 'rambdax/src/rambda/allPass.js'
import anyPass from 'rambdax/src/rambda/anyPass.js'
import equals_SLOW from 'rambdax/src/rambda/equals.js'
import groupBy from 'rambdax/src/rambda/groupBy.js'
import keys from 'rambdax/src/rambda/keys.js'
import map from 'rambdax/src/rambda/map.js'
import pickAll from 'rambdax/src/rambda/pickAll.js'
import pipe from 'rambdax/src/rambda/pipe.js'
import piped from 'rambdax/src/piped.js'
import promiseAllObject from 'rambdax/src/promiseAllObject.js'
import sortBy from 'rambdax/src/rambda/sortBy.js'
import splitEvery from 'rambdax/src/rambda/splitEvery.js'
import values from 'rambdax/src/rambda/values.js'

export {
  allPass,
  anyPass,
  equals_SLOW,
  groupBy,
  keys,
  map,
  pickAll,
  pipe,
  piped,
  promiseAllObject,
  sortBy,
  splitEvery,
  values,
}

export { default as allPromises } from './allPromises'
export { default as identicalArrays } from './identicalArrays'
export { default as isObject } from './isObject'
export { default as noop } from './noop'
export { default as arrayDifference } from './arrayDifference'
export type { ArrayDiff } from './arrayDifference'
export { default as fromPairs } from './fromPairs'
export { default as toPairs } from './toPairs'
export { default as unnest } from './unnest'
export { default as identity } from './identity'
export { default as unique } from './unique'
