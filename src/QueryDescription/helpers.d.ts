import type { Clause, QueryDescription } from './type'

export function buildQueryDescription(clauses: Clause[]): QueryDescription

export function queryWithoutDeleted(query: QueryDescription): QueryDescription
