// @flow

import { invariant } from '../../../utils/common'

import type { SerializedQuery } from '../../../Query'

import type { DirtyRaw } from '../../../RawRecord'

import encodeQuery from './encodeQuery'
import performJoins from './performJoins'
import type { Loki, LokiResultset } from '../type'
import type { LokiJoin } from './encodeQuery'

// Finds IDs of matching records on foreign table
function performJoin(join: LokiJoin, loki: Loki): DirtyRaw[] {
  const { table, query } = join

  const collection = loki.getCollection(table).chain()
  const records = collection.find(query).data()

  return records
}

function performQuery(query: SerializedQuery, loki: Loki): LokiResultset {
  // Step one: perform all inner queries (JOINs) to get the single table query
  const lokiQuery = encodeQuery(query)
  const mainQuery = performJoins(lokiQuery, (join) => performJoin(join, loki))

  // Step two: fetch all records matching query
  const collection = loki.getCollection(query.table).chain()
  let resultset = collection.find(mainQuery)

  // Step three: sort, skip, take
  const { sortBy, take, skip } = query.description
  if (sortBy.length) {
    if (process.env.NODE_ENV !== 'production') {
      invariant(!sortBy.some((sort) => sort.table), 'sortBy is not supported on joined table')
    }

    resultset = resultset.compoundsort(
      sortBy.map(({ sortColumn, sortOrder }) => [sortColumn, sortOrder === 'desc']),
    )
  }
  if (skip) {
    resultset = resultset.offset(skip)
  }
  if (take) {
    resultset = resultset.limit(take)
  }

  return resultset
}

export function executeQuery(query: SerializedQuery, loki: Loki): DirtyRaw[] {
  const { lokiTransform } = query.description
  const results = performQuery(query, loki).data()

  if (lokiTransform) {
    return lokiTransform(results, loki)
  }

  return results
}

export function executeCount(query: SerializedQuery, loki: Loki): number {
  const { lokiTransform } = query.description
  const resultset = performQuery(query, loki)

  if (lokiTransform) {
    const records = lokiTransform(resultset.data(), loki)
    return records.length
  }
  return resultset.count()
}
