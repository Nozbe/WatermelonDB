// @flow

// Returns a list of unique elements, compared by identity (===)
// This is a replacement for rambdax uniq() which is based on slow equals()
export default function unique<T>(list: T[]): T[] {
  const result: T[] = []

  for (let i = 0, len = list.length; i < len; i += 1) {
    const value = list[i]

    let isUnique = true
    for (let j = 0, resultLen = result.length; j < resultLen; j += 1) {
      if (value === result[j]) {
        isUnique = false
        break
      }
    }
    if (isUnique) {
      result.push(value)
    }
  }

  return result
}
