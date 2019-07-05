// @flow

import {hasIn, allPromises} from '../utils/fp'

import type Model from './index'

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

export async function fetchChildren(model: Model): Promise<Model[]> {
  const { associations } = model.constructor
  const childrenKeys = Object.keys(associations).filter(key => associations[key].type === 'has_many')

  const childPromise = async key => {
    const children = await model[key].fetch()
    const grandchildren = await allPromises(child => fetchChildren(child), children)
    return Array.prototype.concat.apply([], grandchildren).concat(children)
  }

  const results = await allPromises(key => childPromise(key), childrenKeys)
  return Array.prototype.concat.apply([], results)
}
