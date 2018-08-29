// inspired by ramda and rambda
/* eslint-disable */

export default function lte(x, y) {
  if (arguments.length === 1) {
    return function(y) {
      return lte(x, y)
    }
  }

  return x <= y
}
