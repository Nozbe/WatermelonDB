// @flow
/* eslint-disable no-use-before-define */

import { invariant } from '../../../utils/common'
import type { SerializedQuery, QueryAssociation } from '../../../Query'
import type {
  NonNullValues,
  Operator,
  Where,
  ComparisonRight,
  Comparison,
  SortBy,
  QueryDescription,
} from '../../../QueryDescription'
import * as Q from '../../../QueryDescription'
import { type TableName, type ColumnName } from '../../../Schema'

import encodeValue from '../encodeValue'
import type { SQL, SQLiteArg } from '../index'

function mapJoin<T>(array: T[], mapper: (T) => string, joiner: string): string {
  // NOTE: DO NOT try to optimize this by concatenating strings together. In non-JIT JSC,
  // concatenating strings is extremely slow (5000ms vs 120ms on 65K sample)
  return array.map(mapper).join(joiner)
}

const encodeValues: (NonNullValues) => string = (values) =>
  `(${mapJoin((values: any[]), encodeValue, ', ')})`

const getComparisonRight = (table: TableName<any>, comparisonRight: ComparisonRight): string => {
  if (comparisonRight.values) {
    return encodeValues(comparisonRight.values)
  } else if (comparisonRight.column) {
    return `"${table}"."${comparisonRight.column}"`
  }

  return typeof comparisonRight.value !== 'undefined' ? encodeValue(comparisonRight.value) : 'null'
}

// Note: it's necessary to use `is` / `is not` for NULL comparisons to work correctly
// See: https://sqlite.org/lang_expr.html
const operators: { [Operator]: string } = {
  eq: 'is',
  notEq: 'is not',
  gt: '>',
  gte: '>=',
  weakGt: '>', // For non-column comparison case
  lt: '<',
  lte: '<=',
  oneOf: 'in',
  notIn: 'not in',
  between: 'between',
  like: 'like',
  notLike: 'not like',
  ftsMatch: 'match',
}

const encodeComparison = (table: TableName<any>, comparison: Comparison) => {
  if (comparison.operator === 'between') {
    const { right } = comparison
    return right.values
      ? `between ${encodeValue(right.values[0])} and ${encodeValue(right.values[1])}`
      : ''
  }

  return `${operators[comparison.operator]} ${getComparisonRight(table, comparison.right)}`
}

const encodeWhere = (table: TableName<any>, associations: QueryAssociation[]) => (
  where: Where,
): string => {
  switch (where.type) {
    case 'and':
      return `(${encodeAndOr(associations, 'and', table, where.conditions)})`
    case 'or':
      return `(${encodeAndOr(associations, 'or', table, where.conditions)})`
    case 'where':
      return encodeWhereCondition(associations, table, where.left, where.comparison)
    case 'on':
      if (process.env.NODE_ENV !== 'production') {
        invariant(
          associations.some(({ to }) => to === where.table),
          'To nest Q.on inside Q.and/Q.or you must explicitly declare Q.experimentalJoinTables at the beginning of the query',
        )
      }
      return `(${encodeAndOr(associations, 'and', where.table, where.conditions)})`
    case 'sql':
      return where.expr
    default:
      throw new Error(`Unknown clause ${where.type}`)
  }
}

const encodeWhereCondition = (
  associations: QueryAssociation[],
  table: TableName<any>,
  left: ColumnName,
  comparison: Comparison,
): string => {
  // if right operand is a value, we can use simple comparison
  // if a column, we must check for `not null > null`
  if (comparison.operator === 'weakGt' && comparison.right.column) {
    return encodeWhere(
      table,
      associations,
    )(
      Q.or(
        // $FlowFixMe
        Q.where(left, Q.gt(Q.column(comparison.right.column))),
        Q.and(Q.where(left, Q.notEq(null)), Q.where((comparison.right: any).column, null)),
      ),
    )
  }


  if (comparison.operator === 'ftsMatch') {
    const srcTable = `"${table}"`
    const ftsTable = `"_fts_${table}"`
    const rowid = '"rowid"'
    const ftsColumn = `"${left}"`
    const matchValue = getComparisonRight(table, comparison.right)
    const ftsTableColumn = table === left ? `${ftsTable}` : `${ftsTable}.${ftsColumn}`
    return (
      `${srcTable}.${rowid} in (` +
      `select ${ftsTable}.${rowid} from ${ftsTable} ` +
      `where ${ftsTableColumn} match ${matchValue}` +
      `)`
    )
  }

  return `"${table}"."${left}" ${encodeComparison(table, comparison)}`
}

const encodeAndOr = (
  associations: QueryAssociation[],
  op: string,
  table: TableName<any>,
  conditions: Where[],
) => {
  if (conditions.length) {
    return mapJoin(conditions, encodeWhere(table, associations), ` ${op} `)
  }
  return ''
}

const andJoiner = ' and '

const encodeConditions = (
  table: TableName<any>,
  description: QueryDescription,
  associations: QueryAssociation[],
): string => {
  const clauses = mapJoin(description.where, encodeWhere(table, associations), andJoiner)

  return clauses.length ? ` where ${clauses}` : ''
}

// If query contains `on()` conditions on tables with which the primary table has a has-many
// relation, then we need to add `distinct` on the query to ensure there are no duplicates
const encodeMethod = (
  table: TableName<any>,
  countMode: boolean,
  needsDistinct: boolean,
): string => {
  if (countMode) {
    return needsDistinct
      ? `select count(distinct "${table}"."id") as "count" from "${table}"`
      : `select count(*) as "count" from "${table}"`
  }

  return needsDistinct
    ? `select distinct "${table}".* from "${table}"`
    : `select "${table}".* from "${table}"`
}

const encodeAssociation = (description: QueryDescription) => ({
  from: mainTable,
  to: joinedTable,
  info: association,
}: QueryAssociation): string => {
  // TODO: We have a problem here. For all of eternity, WatermelonDB Q.ons were encoded using JOIN
  // However, this precludes many legitimate use cases for Q.ons once you start nesting them
  // (e.g. get tasks where X or has a tag assignment that Y -- if there is no tag assignment, this will
  // fail to join)
  // LEFT JOIN needs to be used to address this… BUT technically that's a breaking change. I never
  // considered a possiblity of making a query like `Q.on(relation_id, x != 'bla')`. Before this would
  // only match if there IS a relation, but with LEFT JOIN it would also match if record does not have
  // this relation. I don't know if there are legitimate use cases where this would change anything
  // so I need more time to think about whether this breaking change is OK to make or if we need to
  // do something more clever/add option/whatever.
  // so for now, i'm making an extreeeeemelyyyy bad hack to make sure that there's no breaking change
  // for existing code and code with nested Q.ons probably works (with caveats)
  const usesOldJoinStyle = description.where.some(
    (clause) => clause.type === 'on' && clause.table === joinedTable,
  )
  const joinKeyword = usesOldJoinStyle ? ' join ' : ' left join '
  const joinBeginning = `${joinKeyword}"${joinedTable}" on "${joinedTable}".`
  return association.type === 'belongs_to'
    ? `${joinBeginning}"id" = "${mainTable}"."${association.key}"`
    : `${joinBeginning}"${association.foreignKey}" = "${mainTable}"."id"`
}

const encodeJoin = (description: QueryDescription, associations: QueryAssociation[]): string =>
  associations.length ? associations.map(encodeAssociation(description)).join('') : ''

const encodeOrderBy = (table: TableName<any>, sortBys: SortBy[]) => {
  if (sortBys.length === 0) {
    return ''
  }
  const orderBys = sortBys
    .map((sortBy) => {
      return `"${table}"."${sortBy.sortColumn}" ${sortBy.sortOrder}`
    })
    .join(', ')
  return ` order by ${orderBys}`
}

const encodeLimitOffset = (limit: ?number, offset: ?number) => {
  if (!limit) {
    return ''
  }
  const optionalOffsetStmt = offset ? ` offset ${offset}` : ''

  return ` limit ${limit}${optionalOffsetStmt}`
}

const encodeQuery = (query: SerializedQuery, countMode: boolean = false): [SQL, SQLiteArg[]] => {
  const { table, description, associations } = query

  // TODO: Test if encoding a `select x.id from x` query speeds up queryIds() calls
  if (description.sql) {
    const { sql, values } = description.sql
    return [sql, values]
  }

  const hasToManyJoins = associations.some(({ info }) => info.type === 'has_many')

  if (process.env.NODE_ENV !== 'production') {
    description.take &&
      invariant(
        !countMode,
        'take/skip is not currently supported with counting. Please contribute to fix this!',
      )
    invariant(!description.lokiTransform, 'unsafeLokiTransform not supported with SQLite')
  }

  const sql =
    encodeMethod(table, countMode, hasToManyJoins) +
    encodeJoin(description, associations) +
    encodeConditions(table, description, associations) +
    encodeOrderBy(table, description.sortBy) +
    encodeLimitOffset(description.take, description.skip)

  return [sql, []]
}

export default encodeQuery
