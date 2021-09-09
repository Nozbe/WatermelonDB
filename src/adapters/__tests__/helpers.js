import { sortBy, identity, pipe, pluck, shuffle } from 'rambdax'
import expect from 'expect-rn'
import { allPromises, toPairs } from '../../utils/fp'

import Model from '../../Model'
import Query from '../../Query'
import { appSchema, tableSchema } from '../../Schema'
import { sanitizedRaw } from '../../RawRecord'

export class MockTask extends Model {
  static table = 'tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
  }
}
export class MockProject extends Model {
  static table = 'projects'

  static associations = {
    tasks: { type: 'has_many', foreignKey: 'project_id' },
    teams: { type: 'belongs_to', key: 'team_id' },
  }
}
export class MockTeam extends Model {
  static table = 'teams'

  static associations = {
    projects: { type: 'has_many', foreignKey: 'team_id' },
    organizations: { type: 'belongs_to', key: 'organization_id' },
  }
}
export class MockOrganization extends Model {
  static table = 'organizations'

  static associations = {}
}
export class MockTagAssignment extends Model {
  static table = 'tag_assignments'

  static associations = {
    tasks: { type: 'belongs_to', key: 'task_id' },
  }
}
export class MockSyncTestRecord extends Model {
  static table = 'sync_tests'
}

export const testSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'num1', type: 'number' },
        { name: 'num2', type: 'number' },
        { name: 'num3', type: 'number' },
        { name: 'float1', type: 'number' }, // TODO: Remove me?
        { name: 'float2', type: 'number' },
        { name: 'text1', type: 'string', isFTS: true },
        { name: 'text2', type: 'string', isFTS: true },
        { name: 'bool1', type: 'boolean' },
        { name: 'bool2', type: 'boolean' },
        { name: 'order', type: 'number' },
        { name: 'from', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'projects',
      columns: [
        { name: 'team_id', type: 'string' },
        { name: 'num1', type: 'number' },
        { name: 'num2', type: 'number' },
        { name: 'text1', type: 'string' },
        { name: 'text2', type: 'string' },
        { name: 'text3', type: 'string' },
        { name: 'bool1', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'teams',
      columns: [
        { name: 'organization_id', type: 'string' },
        { name: 'num1', type: 'number' },
        { name: 'num2', type: 'number' },
        { name: 'text1', type: 'string' },
        { name: 'bool1', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'organizations',
      columns: [
        { name: 'num1', type: 'number' },
        { name: 'text1', type: 'string' },
        { name: 'bool1', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'tag_assignments',
      columns: [
        { name: 'task_id', type: 'string' },
        { name: 'num1', type: 'number' },
        { name: 'num2', type: 'number' },
        { name: 'text1', type: 'string' },
      ],
    }),
    // weird names that are SQLite keywords
    tableSchema({ name: 'where', columns: [] }),
    tableSchema({ name: 'values', columns: [] }),
    tableSchema({ name: 'set', columns: [] }),
    tableSchema({ name: 'drop', columns: [] }),
    tableSchema({ name: 'update', columns: [] }),
    tableSchema({
      name: 'sync_tests',
      columns: [
        { name: 'str', type: 'string' },
        { name: 'strN', type: 'string', isOptional: true },
        { name: 'num', type: 'number' },
        { name: 'numN', type: 'number', isOptional: true },
        { name: 'bool', type: 'boolean' },
        { name: 'boolN', type: 'boolean', isOptional: true },
      ],
    }),
  ],
})

const mockCollections = {
  tasks: MockTask,
  projects: MockProject,
  teams: MockTeam,
  tag_assignments: MockTagAssignment,
  sync_tests: MockSyncTestRecord,
}

export const modelQuery = (modelClass, ...conditions) => {
  const mockCollection = {
    modelClass,
    db: { get: (table) => ({ modelClass: mockCollections[table] }) },
  }
  return new Query(mockCollection, conditions)
}

export const taskQuery = (...conditions) => modelQuery(MockTask, ...conditions).serialize()
export const projectQuery = (...conditions) => modelQuery(MockProject, ...conditions).serialize()

export const mockTaskRaw = (raw) => sanitizedRaw(raw, testSchema.tables.tasks)
export const mockProjectRaw = (raw) => sanitizedRaw(raw, testSchema.tables.projects)
export const mockTagAssignmentRaw = (raw) => sanitizedRaw(raw, testSchema.tables.tag_assignments)

const insertAll = async (adapter, table, records) =>
  adapter.batch(
    records.map((raw) => {
      // TODO: Are we sure we want to test this by inserting non-sanitized records?
      // On one hand, this _shouldn't_ happen, on the other, through error or malice
      // (changing DB directly, outside of Wmelon), it _might_ happen
      return ['create', table, { _status: '', ...raw }]
    }),
  )

const sort = sortBy(identity)
const getExpectedResults = pipe(pluck('id'), sort)

export const expectSortedEqual = (actual, expected) => {
  expect(sort(actual)).toEqual(sort(expected))
}

export const performMatchTest = async (adapter, testCase) => {
  const { matching, nonMatching, query: conditions } = testCase

  // NOTE: shuffle so that order test does not depend on insertion order
  await insertAll(adapter, 'tasks', shuffle(matching))
  await insertAll(adapter, 'tasks', shuffle(nonMatching))

  const query = taskQuery(...conditions)

  // test if query fetch is correct
  if (!testCase.skipQuery) {
    const results = await adapter.query(query)
    const expectedResults = getExpectedResults(matching)
    expect(sort(results)).toEqual(expectedResults)

    if (testCase.checkOrder) {
      expect(results).toEqual(pluck('id', matching))
    }

    // test if ID fetch is correct
    const ids = await adapter.queryIds(query)
    expect(sort(ids)).toEqual(expectedResults)
  }

  // test if counting is correct
  if (!testCase.skipCount) {
    const count = await adapter.count(query)
    expect(count).toBe(matching.length)
  }

  // delete
  await adapter.batch(
    [...matching, ...nonMatching].map(({ id }) => ['destroyPermanently', 'tasks', id]),
  )
}

export const performJoinTest = async (adapter, testCase) => {
  const pairs = toPairs(testCase.extraRecords)
  await allPromises(([table, records]) => insertAll(adapter, table, records), pairs)
  await performMatchTest(adapter, testCase)
}

export const performFtsMatchTest = async (adapter, testCase) => {
  const pairs = toPairs(testCase.extraRecords)
  await allPromises(([table, records]) => insertAll(adapter, table, records), pairs)
  await performMatchTest(adapter, testCase)
}
