import { mockDatabase } from '../../__tests__/testModels'

import Query from '../../Query'
import * as Q from '../../QueryDescription'

import subscribeToSimpleQuery from './index'

const makeMock = (db, name) =>
  db.action(() => db.get('mock_tasks').create(mock => {
    mock.name = name
  }))

describe('subscribeToSimpleQuery', () => {
  it('observes changes correctly', async () => {
    const { db } = mockDatabase()

    // insert a few models
    const m1 = await makeMock(db, 'bad_name')
    const m2 = await makeMock(db, 'foo')

    // start observing
    const query = new Query(db.collections.get('mock_tasks'), [Q.where('name', 'foo')])
    const observer = jest.fn()
    const unsubscribe = subscribeToSimpleQuery(query, observer)

    // check initial matches
    await new Promise(process.nextTick) // give time to propagate
    expect(observer).toHaveBeenCalledWith([m2])

    // make some irrelevant changes (no emission)
    const m3 = await makeMock(db, 'irrelevant')
    await db.action(async () => {
      await m1.update(mock => {
        mock.name = 'still_bad_name'
      })
      await m1.destroyPermanently()
    })

    // add a matching record
    const m4 = await makeMock(db, 'foo')
    expect(observer).toHaveBeenCalledWith([m2, m4])

    // change existing record to match
    await db.action(() => m3.update(mock => {
      mock.name = 'foo'
    }))
    expect(observer).toHaveBeenCalledWith([m2, m4, m3])

    // change existing record to no longer match
    await db.action(() => m4.update(mock => {
      mock.name = 'nope'
    }))
    expect(observer).toHaveBeenCalledWith([m2, m3])

    // change matching record in irrelevant ways (no emission)
    await db.action(() => m3.update())

    // remove matching record
    await db.action(() => m2.destroyPermanently())
    expect(observer).toHaveBeenCalledWith([m3])

    // ensure no extra emissions
    unsubscribe()
    expect(observer).toHaveBeenCalledTimes(5)
  })
})
