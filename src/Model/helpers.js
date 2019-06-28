// @flow

import hasIn from '../utils/fp/hasIn'

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
  const { associations } = model.collection.modelClass
  const childrenKeys = Object.keys(associations).filter(key => associations[key].type === 'has_many')
  
  const promises = childrenKeys.map(async key => {
    const children = await model[key].fetch()
    const childrenPromises = children.map(async child => {
      return fetchChildren(child)
    })
    const grandchildren = await Promise.all(childrenPromises)
    let result = []
    grandchildren.forEach(elt => {result = [...result, ...elt]})
    return [...result, ...children]
  })

  const results = await Promise.all(promises)
  let descendants = []
  results.forEach(res => {descendants = [...descendants, ...res]})
  return descendants
}
