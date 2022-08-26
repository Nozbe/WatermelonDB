// @flow

import { type Unsubscribe } from '../utils/subscriptions'

import type Query from '../Query'
import type Model from '../Model'

import subscribeToQueryReloading from './subscribeToQueryReloading'
import subscribeToSimpleQuery from './subscribeToSimpleQuery'
import canEncodeMatcher from './encodeMatcher/canEncode'

export default function subscribeToQuery<Record: Model>(
  query: Query<Record>,
  subscriber: (Record[]) => void,
): Unsubscribe {
  return canEncodeMatcher(query.description)
    ? subscribeToSimpleQuery(query, subscriber)
    : subscribeToQueryReloading(query, subscriber)
}
