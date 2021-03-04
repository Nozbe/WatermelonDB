// @flow

// reexport from rambdax

// TODO: Remove or merge into our codebase all of these
import equals_SLOW from 'rambdax/src/rambda/equals.js'
import map from 'rambdax/src/rambda/map.js'
import promiseAllObject from 'rambdax/src/promiseAllObject.js'

export {
  equals_SLOW,
  map,
  promiseAllObject,
}

export { default as groupBy } from './groupBy'
export { default as allPromises } from './allPromises'
export { default as identicalArrays } from './identicalArrays'
export { default as isObject } from './isObject'
export { default as noop } from './noop'
export type { ArrayDiff } from './arrayDifference'
export { default as fromPairs } from './fromPairs'
export { default as toPairs } from './toPairs'
export { default as unnest } from './unnest'
export { default as identity } from './identity'
export { default as unique } from './unique'
export { default as keys } from './keys'
export { default as values } from './values'
