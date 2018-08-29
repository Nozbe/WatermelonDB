// inspired by ramda and rambda
/* eslint-disable */

function _containsWith(pred, value, arr) {
  for (var i = 0, l = arr.length; i < l; i++) {
    if (pred(value, arr[i])) {
      return true
    }
  }

  return false
}

export default function differenceWith(pred, fst, snd) {
  if (fst === undefined) {
    return function(fst, snd) {
      if (snd === undefined) {
        return function(snd) {
          return differenceWith(pred, fst, snd)
        }
      }

      return differenceWith(pred, fst, snd)
    }
  } else if (snd === undefined) {
    return function(snd) {
      return differenceWith(pred, fst, snd)
    }
  }

  var result = []

  for (var i = 0, l = fst.length; i < l; i++) {
    if (!_containsWith(pred, fst[i], snd) && !_containsWith(pred, fst[i], result)) {
      result.push(fst[i])
    }
  }

  return result
}
