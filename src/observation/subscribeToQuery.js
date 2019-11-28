// @flow

import type Query from '../Query'
import type Model from '../Model'

import subscribeToQueryReloading from './subscribeToQueryReloading'
import subscribeToSimpleQuery from './subscribeToSimpleQuery'

export default function subscribeToQuery<Record: Model>(
  query: Query<Record>,
  subscriber: (Record[]) => void,
): () => void {
  return query.hasJoins
    ? subscribeToQueryReloading(query, subscriber)
    : subscribeToSimpleQuery(query, subscriber)
}
