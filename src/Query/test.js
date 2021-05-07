import { mockDatabase } from '../__tests__/testModels'

import Model from '../Model'
import * as Q from '../QueryDescription'

import Query from './index'

// TODO: Standardize these mocks (same as in sqlite encodeQuery, query test)

class MockTask extends Model {
  static table = 'mock_tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
    fake1: { type: 'has_many', foreignKey: 'task_id' },
  }
}

class MockProject extends Model {
  static table = 'projects'

  static associations = {
    teams: { type: 'belongs_to', key: 'team_id' },
    fake1: { type: 'belongs_to', key: 'team_id' },
  }
}

const mockCollection = Object.freeze({
  modelClass: MockTask,
  db: { get: (table) => (table === 'projects' ? { modelClass: MockProject } : undefined) },
})

describe('Query', () => {
  describe('description properties', () => {
    it('fetches tables correctly for simple queries', () => {
      const query = new Query(mockCollection, [Q.where('id', 'abcdef')])
      expect(query.table).toBe('mock_tasks')
      expect(query.secondaryTables).toEqual([])
      expect(query.allTables).toEqual(['mock_tasks'])
    })
    it('fetches tables correctly for complex queries', () => {
      const query = new Query(mockCollection, [
        Q.where('id', 'abcdef'),
        Q.on('projects', 'team_id', 'abcdef'),
      ])
      expect(query.table).toBe('mock_tasks')
      expect(query.secondaryTables).toEqual(['projects'])
      expect(query.allTables).toEqual(['mock_tasks', 'projects'])
    })
    it('fetches associations correctly for simple queries', () => {
      const query = new Query(mockCollection, [Q.where('id', 'abcdef')])
      expect(query.associations).toEqual([])
    })
    it('fetches associations correctly for more complex queries', () => {
      const query = new Query(mockCollection, [
        Q.on('projects', 'team_id', 'abcdef'),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      ])
      expect(query.secondaryTables).toEqual(['projects', 'tag_assignments'])
      expect(query.associations).toEqual([
        { from: 'mock_tasks', to: 'projects', info: { type: 'belongs_to', key: 'project_id' } },
        {
          from: 'mock_tasks',
          to: 'tag_assignments',
          info: { type: 'has_many', foreignKey: 'task_id' },
        },
      ])
    })
    it('fetches associations correctly for explicit joins', () => {
      const query = new Query(mockCollection, [
        Q.experimentalJoinTables(['projects']),
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.on('projects', Q.on('teams', 'foo', 'bar')),
      ])
      expect(query.secondaryTables).toEqual(['projects', 'teams'])
      expect(query.associations).toEqual([
        { from: 'mock_tasks', to: 'projects', info: { type: 'belongs_to', key: 'project_id' } },
        { from: 'projects', to: 'teams', info: { type: 'belongs_to', key: 'team_id' } },
      ])
    })
    it(`throws an error on incorrect associations`, () => {
      expect(
        () => new Query(mockCollection, [Q.experimentalJoinTables(['blaublams'])]).associations,
      ).toThrow(
        `Query on 'mock_tasks' joins with 'blaublams', but MockTask does not have associations={} defined for 'blaublams'`,
      )
      expect(
        () =>
          new Query(mockCollection, [Q.experimentalNestedJoin('blaublams', 'flaflas')])
            .associations,
      ).toThrow(
        `Query on 'mock_tasks' has a nested join with 'blaublams', but collection for 'blaublams' cannot be found`,
      )
      expect(
        () =>
          new Query(mockCollection, [Q.experimentalNestedJoin('projects', 'flaflas')]).associations,
      ).toThrow(
        `Query on 'mock_tasks' has a nested join from 'projects' to 'flaflas', but MockProject does not have associations={} defined for 'flaflas'`,
      )
    })
    it('can return extended query', () => {
      const query = new Query(mockCollection, [
        Q.on('projects', 'team_id', 'abcdef'),
        Q.where('left_column', 'right_value'),
      ])
      const extendedQuery = query.extend(
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
        Q.where('id', 'abcdef'),
      )
      const expectedQuery = new Query(mockCollection, [
        Q.on('projects', 'team_id', 'abcdef'),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
        Q.where('id', 'abcdef'),
      ])
      expect(extendedQuery.collection).toBe(expectedQuery.collection)
      expect(extendedQuery.modelClass).toBe(expectedQuery.modelClass)
      expect(extendedQuery.description).toEqual(expectedQuery.description)
      expect(extendedQuery.secondaryTables).toEqual(expectedQuery.secondaryTables)
      expect(extendedQuery.associations).toEqual(expectedQuery.associations)
      expect(extendedQuery._rawDescription).toEqual(expectedQuery._rawDescription)
    })
    it('can return extended query for sortBy, take and skip', () => {
      const query = new Query(mockCollection, [
        Q.experimentalSortBy('sortable', Q.desc),
        Q.experimentalSkip(60),
        Q.experimentalTake(20),
      ])
      const extendedQuery = query.extend(
        Q.experimentalSortBy('sortable2'),
        Q.experimentalSkip(40),
        Q.experimentalTake(10),
      )
      const expectedQuery = new Query(mockCollection, [
        Q.experimentalSortBy('sortable', Q.desc),
        Q.experimentalSortBy('sortable2', Q.asc),
        Q.experimentalSkip(40),
        Q.experimentalTake(10),
      ])
      expect(extendedQuery.serialize()).toEqual(expectedQuery.serialize())
      expect(extendedQuery._rawDescription).toEqual(expectedQuery._rawDescription)
    })
    it('can return extended query and leave take and skip clauses intact', () => {
      const query = new Query(mockCollection, [
        Q.experimentalSortBy('sortable', Q.desc),
        Q.experimentalSkip(60),
        Q.experimentalTake(20),
      ])
      const extendedQuery = query.extend(Q.experimentalSortBy('sortable2'))
      const expectedQuery = new Query(mockCollection, [
        Q.experimentalSortBy('sortable', Q.desc),
        Q.experimentalSortBy('sortable2', Q.asc),
        Q.experimentalSkip(60),
        Q.experimentalTake(20),
      ])
      expect(extendedQuery.serialize()).toEqual(expectedQuery.serialize())
      expect(extendedQuery._rawDescription).toEqual(expectedQuery._rawDescription)
    })
    it(`can extend query for join tables`, () => {
      const query = new Query(mockCollection, [
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.experimentalNestedJoin('projects', 'teams'),
      ])
      const extendedQuery = query.extend(
        Q.experimentalJoinTables(['projects', 'fake1']),
        Q.experimentalNestedJoin('projects', 'fake1'),
      )
      const expectedQuery = new Query(mockCollection, [
        Q.experimentalJoinTables(['projects', 'tag_assignments', 'fake1']),
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.experimentalNestedJoin('projects', 'fake1'),
      ])
      expect(extendedQuery.serialize()).toEqual(expectedQuery.serialize())
    })
    it(`can extend query with unsafeLokiTransform`, () => {
      const fn = () => {}
      const query = new Query(mockCollection, [Q.unsafeLokiTransform(fn)])
      const extendedQuery = query.extend(Q.where('foo', 'bar'))
      const expectedQuery = new Query(mockCollection, [
        Q.unsafeLokiTransform(fn),
        Q.where('foo', 'bar'),
      ])
      expect(extendedQuery.serialize()).toEqual(expectedQuery.serialize())
    })
    it('returns serializable version of Query', () => {
      const query = new Query(mockCollection, [
        Q.on('projects', 'team_id', 'abcdef'),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      ])
      expect(query.serialize()).toEqual({
        table: 'mock_tasks',
        description: query.description,
        associations: query.associations,
      })
    })

    it('can return double extended query', () => {
      const query = new Query(mockCollection, [Q.on('projects', 'team_id', 'abcdef')])
      const extendedQuery = query
        .extend(
          Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
          Q.where('left_column', 'right_value'),
        )
        .extend(Q.on('projects', 'team_id', 'abcdefg'), Q.where('id', 'abcdef'))
      const expectedQuery = new Query(mockCollection, [
        Q.on('projects', 'team_id', 'abcdef'),
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
        Q.where('left_column', 'right_value'),
        Q.on('projects', 'team_id', 'abcdefg'),
        Q.where('id', 'abcdef'),
      ])
      expect(extendedQuery.collection).toBe(expectedQuery.collection)
      expect(extendedQuery.modelClass).toBe(expectedQuery.modelClass)
      expect(extendedQuery.description).toEqual(expectedQuery.description)
      expect(extendedQuery.secondaryTables).toEqual(expectedQuery.secondaryTables)
      expect(extendedQuery.associations).toEqual(expectedQuery.associations)
      expect(extendedQuery._rawDescription).toEqual(expectedQuery._rawDescription)
    })
    it('can pipe query', () => {
      const query = new Query(mockCollection, [Q.on('projects', 'team_id', 'abcdef')])
      const identity = (a) => a
      expect(query.pipe(identity)).toBe(query)
      const wrap = (q) => ({ wrapped: q })
      expect(query.pipe(wrap).wrapped).toBe(query)
    })
  })
  describe('fetching', () => {
    it.skip(`can fetch query`, async () => {
      // no test here - Collection._fetchQuery is tested
    })
    it.skip(`can fetch count`, async () => {
      // no test here - Collection._fetchCount is tested
    })
    it(`is thenable`, async () => {
      const { database, tasks } = mockDatabase()
      const queryAll = new Query(tasks, [])
      const m1 = tasks.prepareCreate()
      const m2 = tasks.prepareCreate()
      await database.action(() => database.batch(m1, m2))
      expect(await queryAll).toEqual([m1, m2])
      expect(await queryAll.then((records) => records.length)).toBe(2)
    })
    it(`count is thenable`, async () => {
      const { database, tasks } = mockDatabase()
      const queryAll = new Query(tasks, [])
      await database.action(() => database.batch(tasks.prepareCreate(), tasks.prepareCreate()))
      expect(await queryAll.count).toEqual(2)
      expect(await queryAll.count.then((length) => length * 2)).toBe(4)
    })
  })

  describe('observation', () => {
    // NOTE: Sanity checks only. Concrete tests: observation/
    const waitFor = (database) => {
      // make sure we wait until end of DB queue without triggering query for
      // easy counting
      return database.adapter.getLocal('nothing')
    }
    const testQueryObservation = async (makeSubscribe, withColumns) => {
      const { database, tasks } = mockDatabase()
      const adapterSpy = jest.spyOn(database.adapter.underlyingAdapter, 'query')
      const query = new Query(tasks, [])
      const observer = jest.fn()

      const unsubscribe = makeSubscribe(query, observer)
      await waitFor(database)
      expect(adapterSpy).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenLastCalledWith([])

      const t1 = await database.action(() => tasks.create())
      await waitFor(database)
      expect(observer).toHaveBeenCalledTimes(2)
      expect(observer).toHaveBeenLastCalledWith([t1])

      // check if cached
      const observer2 = jest.fn()
      const unsubscribe2 = makeSubscribe(query, observer2)
      if (withColumns) {
        await waitFor(database)
      }
      expect(observer2).toHaveBeenCalledTimes(1)
      expect(observer2).toHaveBeenLastCalledWith([t1])
      expect(adapterSpy).toHaveBeenCalledTimes(withColumns ? 2 : 1)

      unsubscribe()
      unsubscribe2()
    }

    it('can observe query', async () => {
      await testQueryObservation((query, subscriber) => {
        const subscription = query.observe().subscribe(subscriber)
        return () => subscription.unsubscribe()
      })
    })
    it('can subscribe to query', async () => {
      await testQueryObservation((query, subscriber) => query.experimentalSubscribe(subscriber))
    })
    it('can observe query with columns', async () => {
      await testQueryObservation((query, subscriber) => {
        const subscription = query.observeWithColumns(['name']).subscribe(subscriber)
        return () => subscription.unsubscribe()
      }, true)
    })
    it('can subscribe to query with columns', async () => {
      await testQueryObservation(
        (query, subscriber) => query.experimentalSubscribeWithColumns(['name'], subscriber),
        true,
      )
    })

    const testCountObservation = async (makeSubscribe, isThrottled) => {
      const { database, tasks } = mockDatabase()
      const adapterSpy = jest.spyOn(database.adapter.underlyingAdapter, 'count')
      const query = new Query(tasks, [])
      const observer = jest.fn()

      const unsubscribe = makeSubscribe(query, observer)
      await waitFor(database)
      expect(adapterSpy).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenLastCalledWith(0)

      if (isThrottled) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      await database.action(() => tasks.create())
      await waitFor(database)

      expect(adapterSpy).toHaveBeenCalledTimes(2)
      expect(observer).toHaveBeenCalledTimes(2)
      expect(observer).toHaveBeenLastCalledWith(1)

      // check if cached
      const observer2 = jest.fn()
      const unsubscribe2 = makeSubscribe(query, observer2)
      expect(observer2).toHaveBeenCalledTimes(1)
      expect(observer2).toHaveBeenLastCalledWith(1)
      expect(adapterSpy).toHaveBeenCalledTimes(2)

      unsubscribe()
      unsubscribe2()
    }

    it('can observe (throttled) count', async () => {
      await testCountObservation((query, subscriber) => {
        const subscription = query.observeCount(true).subscribe(subscriber)
        return () => subscription.unsubscribe()
      }, true)
    })
    it('can observe (unthrottled) count', async () => {
      await testCountObservation((query, subscriber) => {
        const subscription = query.observeCount(false).subscribe(subscriber)
        return () => subscription.unsubscribe()
      })
    })
    it('can subscribe to count', async () => {
      await testCountObservation((query, subscriber) =>
        query.experimentalSubscribeToCount(subscriber),
      )
    })
  })

  describe('mass delete', () => {
    const testMassDelete = async (methodName) => {
      const { database, tasks } = mockDatabase()
      const query = new Query(tasks, [Q.where('name', 'foo')])
      const queryAll = new Query(tasks, [])

      await database.action(() =>
        database.batch(
          tasks.prepareCreate((t) => {
            t.name = 'foo'
          }),
          tasks.prepareCreate((t) => {
            t.name = 'foo'
          }),
          tasks.prepareCreate((t) => {
            t.name = 'foo'
          }),
          tasks.prepareCreate(),
          tasks.prepareCreate(),
        ),
      )
      expect(await queryAll.fetchCount()).toBe(5)
      expect(await query.fetchCount()).toBe(3)
      await database.action(() => query[methodName]())
      expect(await queryAll.fetchCount()).toBe(2)
      expect(await query.fetchCount()).toBe(0)
    }
    it('can mark all as deleted', async () => {
      await testMassDelete('markAllAsDeleted')
    })
    it('can destroy all permanently', async () => {
      await testMassDelete('destroyAllPermanently')
    })
  })

  it(`has wmelon tag`, () => {
    const query = new Query(mockCollection, [Q.where('id', 'abcdef')])
    expect(query.constructor._wmelonTag).toBe('query')
  })
})
