// @flow

import { type Unsubscribe } from '../utils/subscriptions'

import type Query from '../Query'
import type Model from '../Model'

import subscribeToQueryReloading from './subscribeToQueryReloading'
import subscribeToSimpleQuery from './subscribeToSimpleQuery'
import { queryNeedsReloading } from './helpers'

export default function subscribeToQuery<Record: Model>(
  query: Query<Record>,
  subscriber: (Record[]) => void,
): Unsubscribe {
  return queryNeedsReloading(query)
    ? subscribeToQueryReloading(query, subscriber)
    : subscribeToSimpleQuery(query, subscriber)
}
