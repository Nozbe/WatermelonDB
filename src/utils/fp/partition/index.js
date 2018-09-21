// inspired by rambda and ramda
/* eslint-disable */

import is from '../is'

export default function partition(pred, arr) {
  if (arr === undefined) {
    return function(arr) {
      return partition(pred, arr)
    }
  }

  if (is(Array, arr)) {
    var tuple = [[], []]

    for (var i = 0, l = arr.length; i < l; i++) {
      var v = arr[i]
      tuple[pred(v) ? 0 : 1].push(v)
    }

    return tuple
  }

  var tuple = [{}, {}]
  const keys = Object.keys(arr)

  for (var i = 0, l = keys.length; i < l; i++) {
    const prop = keys[i]
    var v = arr[prop]
    tuple[pred(v) ? 0 : 1][prop] = v
  }

  return tuple
}
