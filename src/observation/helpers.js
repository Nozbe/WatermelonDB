// @flow

import type Query from '../Query'

export function queryNeedsReloading(query: Query<any>): boolean {
  // inclusion of these clauses causes observation to switch to a less efficient reloading method
  const { joinTables, sortBy, take, skip } = query.description
  return !!joinTables.length || !!sortBy.length || !!take || !!skip
}
