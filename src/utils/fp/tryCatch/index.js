// inspired by ramda and rambda
/* eslint-disable */

export default function tryCatch(tryer, catcher, value) {
  if (catcher === undefined) {
    return function(catcher, value) {
      if (value === undefined) {
        return function(value) {
          return tryCatch(tryer, catcher, value)
        }
      }

      return tryCatch(tryer, catcher, value)
    }
  } else if (value === undefined) {
    return function(value) {
      return tryCatch(tryer, catcher, value)
    }
  }

  try {
    return tryer.apply(this, [value])
  } catch (err) {
    return catcher.apply(this, [err, value])
  }
}
