// @flow
import withoutIdentical from '../withoutIdentical'

export type ArrayDiff<T> = $Exact<{ added: T[], removed: T[] }>

const arrayDifference = <A, T: A>(previousList: T[], newList: T[]): ArrayDiff<T> => ({
  added: withoutIdentical(previousList, newList),
  removed: withoutIdentical(newList, previousList),
})

export default arrayDifference
