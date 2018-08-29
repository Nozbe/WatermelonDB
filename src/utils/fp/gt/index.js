// inspired by ramda and rambda
/* eslint-disable */

export default function gt(x, y) {
  if (arguments.length === 1) {
    return function(y) {
      return gt(x, y)
    }
  }

  return x > y
}
