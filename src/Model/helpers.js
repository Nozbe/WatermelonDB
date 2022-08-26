// @flow

import { allPromises, unnest } from '../utils/fp'

import * as Q from '../QueryDescription'
import type Model from './index'
import type Query from '../Query/index'

type TimestampsObj = $Exact<{ created_at?: number, updated_at?: number }>
export const createTimestampsFor = (model: Model): TimestampsObj => {
  const date = Date.now()
  const timestamps = {}

  if ('createdAt' in model) {
    timestamps.created_at = date
  }

  if ('updatedAt' in model) {
    timestamps.updated_at = date
  }

  return (timestamps: any)
}

function getChildrenQueries(model: Model): Query<Model>[] {
  const associationsList: Array<[any, any]> = Object.entries(model.constructor.associations)
  const hasManyAssociations = associationsList.filter(([, value]) => value.type === 'has_many')
  const childrenQueries = hasManyAssociations.map(([key, value]) => {
    const childCollection = model.collections.get(key)
    return childCollection.query(Q.where(value.foreignKey, model.id))
  })
  return childrenQueries
}

export async function fetchChildren(model: Model): Promise<Model[]> {
  const childPromise = async (query) => {
    const children = await query.fetch()
    const grandchildren = await allPromises(fetchChildren, children)
    return unnest(grandchildren).concat(children)
  }
  const childrenQueries = getChildrenQueries(model)
  const results = await allPromises(childPromise, childrenQueries)
  return unnest(results)
}
