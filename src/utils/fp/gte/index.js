// inspired by ramda and rambda
/* eslint-disable */

export default function gte(x, y) {
  if (arguments.length === 1) {
    return function(y) {
      return gte(x, y)
    }
  }

  return x >= y
}
