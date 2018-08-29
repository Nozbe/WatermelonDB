// inspired by ramda and rambda
/* eslint-disable */

export default function objOf(key, value) {
  if (arguments.length === 1) {
    return function(value) {
      return objOf(key, value)
    }
  }

  var obj = {}
  obj[key] = value
  return obj
}
