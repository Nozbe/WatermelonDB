import Query from '../../Query'
import * as Q from '../../QueryDescription'
import encodeMatcher from './index'
import { matchTests, naughtyMatchTests } from '../../__tests__/databaseTests'

const mockModelClass = { table: 'tasks' }
const mockCollection = { modelClass: mockModelClass }

const makeMatcher = conditions => encodeMatcher(new Query(mockCollection, conditions).description)

const expectTrue = (matcher, raw) => expect(matcher(raw)).toBe(true)
const expectFalse = (matcher, raw) => expect(matcher(raw)).toBe(false)

describe('SQLite encodeMatcher', () => {
  matchTests.forEach(testCase => {
    it(`passes db test: ${testCase.name}`, () => {
      if (testCase.skipMatcher) {
        return
      }
      const matcher = makeMatcher(testCase.query)

      testCase.matching.forEach(matchingRaw => {
        expectTrue(matcher, matchingRaw)
      })

      testCase.nonMatching.forEach(nonMatchingRaw => {
        expectFalse(matcher, nonMatchingRaw)
      })
    })
  })
  it('passes big-list-of-naughty-string matches', () => {
    naughtyMatchTests.forEach(testCase => {
      // console.log(testCase.name)
      const matcher = makeMatcher(testCase.query)

      testCase.matching.forEach(matchingRaw => {
        expectTrue(matcher, matchingRaw)
      })

      testCase.nonMatching.forEach(nonMatchingRaw => {
        expectFalse(matcher, nonMatchingRaw)
      })
    })
  })
  it('throws on queries it cannot encode', () => {
    const error = `can't be encoded into a matcher`
    expect(() => makeMatcher([Q.on('projects', 'team_id', 'abcdef')])).toThrow(error)
    expect(() => makeMatcher([Q.experimentalJoinTables(['foo'])])).toThrow(error)
    expect(() => makeMatcher([Q.experimentalNestedJoin('foo', 'bar')])).toThrow(error)
    expect(() => makeMatcher([Q.experimentalSortBy('left_column', 'asc')])).toThrow(error)
    expect(() => makeMatcher([Q.experimentalTake(100)])).toThrow(error)
    expect(() => makeMatcher([Q.experimentalTake(100)])).toThrow(error)
    expect(() => makeMatcher([Q.or(Q.on('projects', 'team_id', 'abcdef'))])).toThrow('Illegal Q.on')
    expect(() => makeMatcher([Q.or(Q.unsafeSqlExpr(''))])).toThrow('Illegal')
    expect(() => makeMatcher([Q.or(Q.unsafeLokiExpr({}))])).toThrow('Illegal')
  })
})
