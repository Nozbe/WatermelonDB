// @flow

// reexport from rambdax

// TODO: Remove or merge into our codebase all of these
import equals_SLOW from 'rambdax/src/rambda/equals.js'
import groupBy from 'rambdax/src/rambda/groupBy.js'
import map from 'rambdax/src/rambda/map.js'
import pipe from 'rambdax/src/rambda/pipe.js'
import piped from 'rambdax/src/piped.js'
import promiseAllObject from 'rambdax/src/promiseAllObject.js'
import sortBy from 'rambdax/src/rambda/sortBy.js'

export {
  equals_SLOW,
  groupBy,
  map,
  pipe,
  piped,
  promiseAllObject,
  sortBy,
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
export { default as keys } from './keys'
export { default as values } from './values'
