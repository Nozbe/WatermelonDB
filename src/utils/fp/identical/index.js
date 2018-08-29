// inspired by ramda and rambda
/* eslint-disable */

export default function identical(a, b) {
  if (arguments.length === 1) {
    return function(b) {
      return identical(a, b)
    }
  }

  if (a === b) {
    return a !== 0 || 1 / a === 1 / b
  }

  return a !== a && b !== b
}
