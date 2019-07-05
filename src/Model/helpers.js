// @flow

import {hasIn, allPromises} from '../utils/fp'

import * as Q from '../QueryDescription'
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
  const hasManyAssociations = Object.entries(model.constructor.associations).filter(([, value]) => value.type === 'has_many')
  const childrenQueries = hasManyAssociations.map(([key, value]) => {
    const childCollection = model.collections.get(key)
    return childCollection.query(Q.where(value.foreignKey, model.id))
  })

  const childPromise = async query => {
    const children = await query.fetch()
    const grandchildren = await allPromises(child => fetchChildren(child), children)
    return Array.prototype.concat.apply([], grandchildren).concat(children)
  }

  const results = await allPromises(query => childPromise(query), childrenQueries)
  return Array.prototype.concat.apply([], results)
}
