/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import type { Unsubscribe } from '../utils/subscriptions'

import type Query from '../Query'
import type Model from '../Model'

export default function subscribeToQuery<Record extends Model>(
  query: Query<Record>,
  subscriber: (records: Record[]) => void,
): Unsubscribe
