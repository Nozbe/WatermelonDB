/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import type { Unsubscribe } from '../../utils/subscriptions'

import type Query from '../../Query'
import type Model from '../../Model'

// Produces an observable version of a query by re-querying the database
// when any change occurs in any of the relevant Stores.
// This is inefficient for simple queries, but necessary for complex queries
export default function subscribeToQueryReloading<Record extends Model>(
  query: Query<Record>,
  subscriber: (records: Record[]) => void,
  // Emits `false` when query fetch begins + always emits even if no change - internal trick needed
  // by observeWithColumns
  shouldEmitStatus?: boolean,
): Unsubscribe
