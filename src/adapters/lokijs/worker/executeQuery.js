// @flow

import Loki from 'lokijs'
import type { LokiResultset } from 'lokijs'

import type { SerializedQuery } from '../../../Query'

import encodeMatcher from '../../../observation/encodeMatcher'
import { hasColumnComparisons, type Where } from '../../../QueryDescription'
import type { DirtyRaw } from '../../../RawRecord'

import encodeQuery from './encodeQuery'
import performJoins from './performJoins'
import type { LokiJoin } from './encodeQuery'

function refineResultsForColumnComparisons(
  roughResults: LokiResultset,
  conditions: Where[],
): LokiResultset {
  if (hasColumnComparisons(conditions)) {
    const queryWithoutJoins = {
      // ignore JOINs (already checked and encodeMatcher can't check it)
      // TODO: This won't work on Q.ons that are nested
      where: conditions.filter(clause => clause.type !== 'on'),
      joinTables: [],
      sortBy: [],
      take: null,
      skip: null,
    }
    const matcher = encodeMatcher(queryWithoutJoins)

    return roughResults.where(matcher)
  }

  return roughResults
}

// Finds IDs of matching records on foreign table
function performJoin(join: LokiJoin, loki: Loki): DirtyRaw[] {
  const { table, query, originalConditions } = join

  // for queries on `belongs_to` tables, matchingIds will be IDs of the parent table records
  //   (e.g. task: { project_id in ids })
  // and for `has_many` tables, it will be IDs of the main table records
  //   (e.g. task: { id in (ids from tag_assignment.task_id) })
  const collection = loki.getCollection(table).chain()
  const roughRecords = collection.find(query)

  // See executeQuery for explanation of column comparison workaround
  const refinedRecords = refineResultsForColumnComparisons(roughRecords, originalConditions)
  return refinedRecords.data()
}

// Note: Loki currently doesn't support column comparisons in its query syntax, so for queries
// that need them, we filter records with a matcher function.
// This is far less efficient, so should be considered a temporary hack/workaround
export default function executeQuery(query: SerializedQuery, loki: Loki): LokiResultset {
  const collection = loki.getCollection(query.table).chain()

  // Step one: perform all inner queries (JOINs) to get the single table query
  const lokiQuery = encodeQuery(query)
  const mainQuery = performJoins(lokiQuery, join => performJoin(join, loki))

  // Step two: fetch all records matching query
  // Ignore column comparison conditions (assume condition is true)
  const roughResults = collection.find(mainQuery)

  // Step three: if query makes column comparison conditions, we (inefficiently) refine
  // the rough results using a matcher function
  return refineResultsForColumnComparisons(roughResults, query.description.where)
}
