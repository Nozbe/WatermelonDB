// @flow

import { CollectionChangeTypes } from '../Collection/common'

import type { BatchOperationType } from '../adapters/type'

export const operationTypeToCollectionChangeType = (input: BatchOperationType) => {
  switch (input) {
    case 'create':
      return CollectionChangeTypes.created
    case 'update':
      return CollectionChangeTypes.updated
    case 'markAsDeleted':
    case 'destroyPermanently':
      return CollectionChangeTypes.destroyed
    default:
      throw new Error(`${input} is invalid operation type`)
  }
}
