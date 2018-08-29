// inspired by ramda and rambda
/* eslint-disable */

export default function fromPairs(pairs) {
  const result = {}

  for (var i = 0, l = pairs.length; i < l; i++) {
    result[pairs[i][0]] = pairs[i][1]
  }

  return result
}
