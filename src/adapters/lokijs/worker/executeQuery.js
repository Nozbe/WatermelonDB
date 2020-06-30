// @flow

import Loki from 'lokijs'
import type { LokiResultset } from 'lokijs'

import type { SerializedQuery } from '../../../Query'

import type { DirtyRaw } from '../../../RawRecord'

import encodeQuery from './encodeQuery'
import performJoins from './performJoins'
import type { LokiJoin } from './encodeQuery'

// Finds IDs of matching records on foreign table
function performJoin(join: LokiJoin, loki: Loki): DirtyRaw[] {
  const { table, query } = join

  const collection = loki.getCollection(table).chain()
  const records = collection.find(query).data()

  return records
}

export default function executeQuery(query: SerializedQuery, loki: Loki): LokiResultset {
  const { lokiFilter } = query.description

  // Step one: perform all inner queries (JOINs) to get the single table query
  const lokiQuery = encodeQuery(query)
  const mainQuery = performJoins(lokiQuery, join => performJoin(join, loki))

  // Step two: fetch all records matching query
  const collection = loki.getCollection(query.table).chain()
  const results = collection.find(mainQuery)

  // Step three: execute extra filter, if passed in query
  if (lokiFilter) {
    return results.where(rawRecord => lokiFilter(rawRecord, loki))
  }
  return results
}
