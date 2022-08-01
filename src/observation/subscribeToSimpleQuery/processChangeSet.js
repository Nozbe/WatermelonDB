// @flow

import type { CollectionChangeSet } from '../../Collection'
import type Model from '../../Model'
import type { Matcher } from '../encodeMatcher'

// WARN: Mutates arguments
export default function processChangeSet<Record: Model>(
  changeSet: CollectionChangeSet<Record>,
  matcher: Matcher<Record>,
  mutableMatchingRecords: Record[],
): boolean {
  let shouldEmit = false
  changeSet.forEach((change) => {
    const { record, type } = change
    const index = mutableMatchingRecords.indexOf(record)
    const currentlyMatching = index > -1

    if (type === 'destroyed') {
      if (currentlyMatching) {
        // Remove if record was deleted
        mutableMatchingRecords.splice(index, 1)
        shouldEmit = true
      }
      return
    }

    const matches = matcher(record._raw)

    if (currentlyMatching && !matches) {
      // Remove if doesn't match anymore
      mutableMatchingRecords.splice(index, 1)
      shouldEmit = true
    } else if (matches && !currentlyMatching) {
      // Add if should be included but isn't
      mutableMatchingRecords.push(record)
      shouldEmit = true
    }
  })
  return shouldEmit
}
