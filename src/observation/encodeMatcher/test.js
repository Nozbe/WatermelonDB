import Query from 'Query'
import * as Q from 'QueryDescription'
import Model from 'Model'
import encodeMatcher from 'observation/encodeMatcher'
import { matchTests } from '../__tests__/databaseTests'

const mockModelClass = { table: 'tasks' }
const mockCollection = { modelClass: mockModelClass }

const makeMatcher = conditions => encodeMatcher(new Query(mockCollection, conditions).description)

const expectModel = (matcher, raw) => expect(matcher(new Model(null, raw)))
const expectTrue = (matcher, raw) => expectModel(matcher, raw).toBe(true)
const expectFalse = (matcher, raw) => expectModel(matcher, raw).toBe(false)

describe('watermelondb/adapters/sqlite/encodeMatcher', () => {
  matchTests.forEach(testCase => {
    it(`passes db test: ${testCase.name}`, () => {
      const matcher = makeMatcher(testCase.query)

      testCase.matching.forEach(matchingRaw => {
        expectTrue(matcher, matchingRaw)
      })

      testCase.nonMatching.forEach(nonMatchingRaw => {
        expectFalse(matcher, nonMatchingRaw)
      })
    })
  })
  it('does not encode JOIN queries', () => {
    expect(() =>
      makeMatcher([
        Q.on('projects', 'team_id', 'abcdef'),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      ]),
    ).toThrow()
  })
})
