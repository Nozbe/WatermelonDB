// @flow

export default function sortBy<T, U>(sorter: (T) => U, list: T[]): T[] {
  const clone = list.slice()
  let a
  let b
  return clone.sort((left, right) => {
    a = sorter(left)
    b = sorter(right)

    if (a === b) {
      return 0
    }
    // $FlowFixMe
    return a < b ? -1 : 1
  })
}
