// inspired by ramda and rambda
/* eslint-disable */

export default function lt(x, y) {
  if (arguments.length === 1) {
    return function(y) {
      return lt(x, y)
    }
  }

  return x < y
}
