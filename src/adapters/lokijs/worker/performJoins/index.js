// @flow

import type { LokiQuery, LokiJoin, LokiRawQuery } from '../encodeQuery'
import type { DirtyRaw } from '../../../../RawRecord'

type QueryPerformer = (join: LokiJoin) => DirtyRaw[]

function performJoinsImpl(query: LokiRawQuery, performer: QueryPerformer): LokiRawQuery {
  if (!query) {
    return query
  } else if (query.$join) {
    const join: LokiJoin = query.$join
    const joinQuery = performJoinsImpl(join.query, performer)
    join.query = joinQuery
    const records = performer(join)

    // for queries on `belongs_to` tables, matchingIds will be IDs of the parent table records
    //   (e.g. task: { project_id in ids })
    // and for `has_many` tables, it will be IDs of the main table records
    //   (e.g. task: { id in (ids from tag_assignment.task_id) })
    const matchingIds = records.map((record) => record[join.mapKey])
    return { [(join.joinKey: string)]: { $in: matchingIds } }
  } else if (query.$and) {
    return { $and: query.$and.map((clause) => performJoinsImpl(clause, performer)) }
  } else if (query.$or) {
    return { $or: query.$or.map((clause) => performJoinsImpl(clause, performer)) }
  }
  return query
}

export default function performJoins(
  lokiQuery: LokiQuery,
  performer: QueryPerformer,
): LokiRawQuery {
  const { query, hasJoins } = lokiQuery

  if (!hasJoins) {
    return query
  }

  return performJoinsImpl(query, performer)
}
