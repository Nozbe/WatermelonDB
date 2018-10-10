// inspired by ramda and rambda
/* eslint-disable */

import is from '../is'

export default function unnest(arr) {
  var result = []

  for (var i = 0, l = arr.length; i < l; i++) {
    var value = arr[i]

    if (is(Array, value)) {
      result = result.concat(value)
    } else {
      result.push(value)
    }
  }

  return result
}
