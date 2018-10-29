// @flow

import identical from '../identical'
import differenceWith from '../differenceWith'

// Like ramda's `without`, but uses `===` and not slow `equals` for comparisons
export default function withoutIdentical<T>(withoutThese: T[], originalList: T[]): T[] {
  // TODO: Rewrite in vanilla JS?
  return differenceWith(identical, originalList, withoutThese)
}
