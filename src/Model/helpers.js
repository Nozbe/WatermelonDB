// @flow

import { allPromises, unnest } from '../utils/fp'

import * as Q from '../QueryDescription'
import type Model from './index'
import type Query from '../Query/index'

type TimestampsObj = $Exact<{ created_at?: number, updated_at?: number }>
export const createTimestampsFor = (model: Model): TimestampsObj => {
  const date = Date.now()
  const timestamps: $Shape<TimestampsObj> = {}

  if ('createdAt' in model) {
    timestamps.created_at = date
  }

  if ('updatedAt' in model) {
    timestamps.updated_at = date
  }

  return timestamps
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

async function fetchDescendantsInner(model: Model): Promise<Model[]> {
  const childPromise = async (query: Query<Model>) => {
    const children = await query.fetch()
    const grandchildren = await allPromises(fetchDescendantsInner, children)
    return unnest(grandchildren).concat(children)
  }
  const childrenQueries = getChildrenQueries(model)
  const results = await allPromises(childPromise, childrenQueries)
  return unnest(results)
}

export async function fetchDescendants(model: Model): Promise<Model[]> {
  const descendants = await fetchDescendantsInner(model)
  // We need to deduplicate because we can have a child accessible through multiple parents
  // TODO: Use fp/unique after updating it not to suck
  return Array.from(new Set(descendants))
}
