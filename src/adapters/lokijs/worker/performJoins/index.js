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
    const records = performer({ ...join, query: joinQuery })
    const matchingIds = records.map(record => record[join.mapKey])
    return { [(join.joinKey: string)]: { $in: matchingIds } }
  } else if (query.$and) {
    return { $and: query.$and.map(clause => performJoinsImpl(clause, performer)) }
  } else if (query.$or) {
    return { $or: query.$or.map(clause => performJoinsImpl(clause, performer)) }
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
