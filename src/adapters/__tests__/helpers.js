import { sortBy, identity, pipe, pluck } from 'rambdax'
import expect from 'expect'
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
  }
}
export class MockTagAssignment extends Model {
  static table = 'tag_assignments'

  static associations = {
    tasks: { type: 'belongs_to', key: 'task_id' },
  }
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
        { name: 'text1', type: 'string' },
        { name: 'text2', type: 'string' },
        { name: 'bool1', type: 'boolean' },
        { name: 'bool2', type: 'boolean' },
        { name: 'order', type: 'number' },
        { name: 'from', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'projects',
      columns: [
        { name: 'num1', type: 'number' },
        { name: 'num2', type: 'number' },
        { name: 'text1', type: 'string' },
        { name: 'text2', type: 'string' },
        { name: 'text3', type: 'string' },
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
  ],
})

export const modelQuery = (modelClass, ...conditions) => {
  const mockCollection = { modelClass }
  return new Query(mockCollection, conditions)
}

export const taskQuery = (...conditions) => modelQuery(MockTask, ...conditions).serialize()
export const projectQuery = (...conditions) => modelQuery(MockProject, ...conditions).serialize()

export const mockTaskRaw = raw => sanitizedRaw(raw, testSchema.tables.tasks)
export const mockProjectRaw = raw => sanitizedRaw(raw, testSchema.tables.projects)

const insertAll = async (adapter, table, records) =>
  adapter.batch(
    records.map(raw => {
      // TODO: Are we sure we want to test this by inserting non-sanitized records?
      // On one hand, this _shouldn't_ happen, on the other, through error or malice
      // (changing DB directly, outside of Wmelon), it _might_ happen
      return ['create', table, { ...raw, _status: '' }]
    }),
  )

const sort = sortBy(identity)
const getExpectedResults = pipe(
  pluck('id'),
  sort,
)

export const expectSortedEqual = (actual, expected) => {
  expect(sort(actual)).toEqual(sort(expected))
}

export const performMatchTest = async (adapter, testCase) => {
  const { matching, nonMatching, query: conditions } = testCase

  await insertAll(adapter, 'tasks', matching)
  await insertAll(adapter, 'tasks', nonMatching)

  const query = taskQuery(...conditions)
  const results = await adapter.query(query)
  expect(sort(results)).toEqual(getExpectedResults(matching))

  // also test if counting works correctly
  const count = await adapter.count(query)
  expect(count).toBe(results.length)
}

export const performJoinTest = async (adapter, testCase) => {
  const pairs = toPairs(testCase.extraRecords)
  await allPromises(([table, records]) => insertAll(adapter, table, records), pairs)
  await performMatchTest(adapter, testCase)
}
