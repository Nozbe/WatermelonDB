// @flow

import Loki from 'lokijs'
import type { LokiResultset } from 'lokijs'

import type { SerializedQuery } from '../../../Query'
import invariant from '../../../utils/common/invariant'

import encodeMatcher from '../../../observation/encodeMatcher'
import { hasColumnComparisons, type Where } from '../../../QueryDescription'

import encodeQuery from './encodeQuery'
import type { LokiQuery, LokiJoin, LokiRawQuery } from './encodeQuery'

function refineResultsForColumnComparisons(
  roughResults: LokiResultset,
  conditions: Where[],
): LokiResultset {
  if (hasColumnComparisons(conditions)) {
    // ignore JOINs (already checked and encodeMatcher can't check it)
    const queryWithoutJoins = { where: conditions, join: [], sortBy: [], take: null, skip: null }
    const matcher = encodeMatcher(queryWithoutJoins)

    return roughResults.where(matcher)
  }

  return roughResults
}

// Finds IDs of matching records on foreign table
function performJoin(join: LokiJoin, loki: Loki): LokiRawQuery {
  const { table, query, originalConditions, mapKey, joinKey } = join

  // for queries on `belongs_to` tables, matchingIds will be IDs of the parent table records
  //   (e.g. task: { project_id in ids })
  // and for `has_many` tables, it will be IDs of the main table records
  //   (e.g. task: { id in (ids from tag_assignment.task_id) })
  const collection = loki.getCollection(table).chain()
  const roughRecords = collection.find(query)

  // See executeQuery for explanation of column comparison workaround
  const refinedRecords = refineResultsForColumnComparisons(roughRecords, originalConditions)
  const matchingIds = refinedRecords.data().map(record => record[mapKey])

  return { [(joinKey: string)]: { $in: matchingIds } }
}

function performJoinsGetQuery(lokiQuery: LokiQuery, loki: Loki): LokiRawQuery {
  const { query, joins } = lokiQuery
  const joinConditions = joins.map(join => performJoin(join, loki))

  return joinConditions.length ? { $and: [...joinConditions, query] } : query
}

// Note: Loki currently doesn't support column comparisons in its query syntax, so for queries
// that need them, we filter records with a matcher function.
// This is far less efficient, so should be considered a temporary hack/workaround
export default function executeQuery(query: SerializedQuery, loki: Loki): LokiResultset {
  // TODO: implement support for Q.sortBy(), Q.take(), Q.skip() for Loki adapter
  invariant(!query.description.sortBy.length, '[WatermelonDB][Loki] Q.sortBy() not yet supported')
  invariant(!query.description.take, '[WatermelonDB][Loki] Q.take() not yet supported')

  const collection = loki.getCollection(query.table).chain()

  // Step one: fetch all records matching query (and consider `on` conditions)
  // Ignore column comparison conditions (assume condition is true)
  const lokiQuery = encodeQuery(query)
  const roughResults = collection.find(performJoinsGetQuery(lokiQuery, loki))

  // Step two: if query makes column comparison conditions, we (inefficiently) refine
  // the rough results using a matcher function
  // Matcher ignores `on` conditions, so it's not possible to use column comparison in an `on`
  const result = refineResultsForColumnComparisons(roughResults, query.description.where)

  return result
}
