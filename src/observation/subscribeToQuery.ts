import {Unsubscribe} from '../utils/subscriptions';

import type Query from '../Query'
import type Model from '../Model'

import subscribeToQueryReloading from './subscribeToQueryReloading'
import subscribeToSimpleQuery from './subscribeToSimpleQuery'
import canEncodeMatcher from './encodeMatcher/canEncode'

export default function subscribeToQuery<Record extends Model>(query: Query<Record>, subscriber: (arg1: Record[]) => void): Unsubscribe {
  return canEncodeMatcher(query.description)
    ? subscribeToSimpleQuery(query, subscriber)
    : subscribeToQueryReloading(query, subscriber)
}
