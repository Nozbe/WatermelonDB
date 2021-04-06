// @flow

// NOTE: Only use with records! Not guaranteed to work correctly if keys have undefineds as values
export default function areRecordsEqual<T: {}>(left: T, right: T): boolean {
  if (left === right) {
    return true
  }

  const leftKeys = Object.keys(left)
  const leftKeysLen = leftKeys.length

  if (leftKeysLen !== Object.keys(right).length) {
    return false
  }

  let key
  for (let i = 0; i < leftKeysLen; i++) {
    key = leftKeys[i]
    if (left[key] !== right[key]) {
      return false
    }
  }
  return true
}
