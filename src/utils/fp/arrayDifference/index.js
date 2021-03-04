// @flow

export type ArrayDiff<T> = $Exact<{ added: T[], removed: T[] }>

const arrayDifference = <A, T: A>(previousList: T[], newList: T[]): ArrayDiff<T> => {
  // TODO: Use Set to avoid n^2 complexity
  const added = []
  const removed = []

  outerPrevious: for (let i = 0, len = previousList.length; i < len; i++) {
    const previousItem = previousList[i]
    for (let j = 0, len2 = newList.length; j < len2; j++) {
      if (previousItem === newList[j]) {
        continue outerPrevious
      }
    }
    removed.push(previousItem)
  }

  outerNew: for (let i = 0, len = newList.length; i < len; i++) {
    const newItem = newList[i]
    for (let j = 0, len2 = previousList.length; j < len2; j++) {
      if (newItem === previousList[j]) {
        continue outerNew;
      }
    }
    added.push(newItem)
  }

  return { added, removed }
}

export default arrayDifference
