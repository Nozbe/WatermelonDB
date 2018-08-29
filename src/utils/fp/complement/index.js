// inspired by rambda
/* eslint-disable */

export default function complement(fn) {
  var args = Array.prototype.slice.call(arguments, 1)

  if (args.length === 0) {
    return function() {
      return complement.apply(this, [fn].concat(Array.prototype.slice.call(arguments, 0)))
    }
  }

  return !fn.apply(this, args)
}
