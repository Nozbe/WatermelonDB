// @flow

import hasIn from 'utils/fp/hasIn'

import type Model from '.'

const hasCreatedAt = hasIn('createdAt')
export const hasUpdatedAt = hasIn('updatedAt')

export const createTimestampsFor = (model: Model) => {
  const date = Date.now()
  const timestamps = {}

  if (hasCreatedAt(model)) {
    timestamps.created_at = date
  }

  if (hasUpdatedAt(model)) {
    timestamps.updated_at = date
  }

  return timestamps
}

// TODO: Measure and optimize performance!

export function addToRawSet(rawSet: ?string, value: string): string {
  const array = rawSet ? rawSet.split(',') : []
  const set = new Set(array)
  set.add(value)
  return Array.from(set).join(',')
}
