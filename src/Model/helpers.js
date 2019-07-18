// @flow

import {allPromises, hasIn, unnest} from '../utils/fp'

import * as Q from '../QueryDescription'
import type Model from './index'
import type Query from '../Query/index'

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

function getChildrenQueries(model: Model): Query<Model>[] {
  const associationsList: any = Object.entries(model.constructor.associations)
  const hasManyAssociations = associationsList.filter(([, value]) => value.type === 'has_many')
  const childrenQueries = hasManyAssociations.map(([key, value]) => {
    const childCollection = model.collections.get(key)
    return childCollection.query(Q.where(value.foreignKey, model.id))
  })
  return childrenQueries
}

export async function fetchChildren(model: Model): Promise<Model[]> {
  const childPromise = async query => {
    const children = await query.fetch()
    const grandchildren = await allPromises(fetchChildren, children)
    return unnest(grandchildren).concat(children)
  }
  const childrenQueries = getChildrenQueries(model)
  const results = await allPromises(childPromise, childrenQueries)
  return unnest(results)
}