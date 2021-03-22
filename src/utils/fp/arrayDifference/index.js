// @flow

export type ArrayDiff<T> = $Exact<{ added: T[], removed: T[] }>

const arrayDifference = <A, T: A>(previousList: T[], nextList: T[]): ArrayDiff<T> => {
  const previous = new Set(previousList)
  const next = new Set(nextList)
  const added = []
  const removed = []

  let item
  for (let i = 0, len = previousList.length; i < len; i++) {
    item = previousList[i]
    if (!next.has(item)) {
      removed.push(item)
    }
  }

  for (let i = 0, len = nextList.length; i < len; i++) {
    item = nextList[i]
    if (!previous.has(item)) {
      added.push(item)
    }
  }

  return { added, removed }
}

export default arrayDifference
