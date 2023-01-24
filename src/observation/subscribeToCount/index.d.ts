/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */

import type { Unsubscribe } from '../../utils/subscriptions'

import type Query from '../../Query'
import type Model from '../../Model'

export function experimentalDisableObserveCountThrottling(): void

// Produces an observable version of a query count by re-querying the database
// when any change occurs in any of the relevant Stores.
//
// TODO: Potential optimizations:
// - increment/decrement counter using matchers on insert/delete
export default function subscribeToCount<Record extends Model>(
  query: Query<Record>,
  isThrottled: boolean,
  subscriber: (_: number) => void,
): Unsubscribe
