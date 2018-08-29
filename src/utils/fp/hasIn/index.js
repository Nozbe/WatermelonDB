// inspired by ramda and rambda
/* eslint-disable */

export default function hasIn(prop, obj) {
  if (obj === undefined) {
    return function(obj) {
      return hasIn(prop, obj)
    }
  }

  return prop in obj
}
