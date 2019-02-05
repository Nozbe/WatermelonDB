import { mockDatabase } from '../../__tests__/testModels'

import Query from '../../Query'
import * as Q from '../../QueryDescription'

import simpleObserver from './index'

const makeDatabase = () => {
  // TODO: Change test to actually go through the DB
  const { database } = mockDatabase()

  database.adapter = {
    batch: jest.fn(),
  }

  return database
}

const makeMock = (database, name) =>
  database.collections.get('mock_tasks').create(mock => {
    mock.name = name
  })

describe('simpleObserver', () => {
  it('observes changes correctly', async () => {
    const database = makeDatabase()

    // insert a few models
    const m1 = await makeMock(database, 'bad_name')
    const m2 = await makeMock(database, 'foo')

    // mock query
    database.adapter.query = jest.fn().mockImplementationOnce(() => [m2.id])

    // start observing
    const query = new Query(database.collections.get('mock_tasks'), [Q.where('name', 'foo')])
    const observer = jest.fn()
    const subscription = simpleObserver(query).subscribe(observer)

    // check initial matches
    await new Promise(process.nextTick) // give time to propagate
    expect(observer).toHaveBeenCalledWith([m2])

    // make some irrelevant changes (no emission)
    const m3 = await makeMock(database, 'irrelevant')
    await m1.update(mock => {
      mock.name = 'still_bad_name'
    })
    await m1.destroyPermanently()

    // add a matching record
    const m4 = await makeMock(database, 'foo')
    expect(observer).toHaveBeenCalledWith([m2, m4])

    // change existing record to match
    await m3.update(mock => {
      mock.name = 'foo'
    })
    expect(observer).toHaveBeenCalledWith([m2, m4, m3])

    // change existing record to no longer match
    await m4.update(mock => {
      mock.name = 'nope'
    })
    expect(observer).toHaveBeenCalledWith([m2, m3])

    // change matching record in irrelevant ways (no emission)
    await m3.update()

    // remove matching record
    await m2.destroyPermanently()
    expect(observer).toHaveBeenCalledWith([m3])

    // ensure no extra emissions
    subscription.unsubscribe()
    expect(observer).toHaveBeenCalledTimes(5)
  })
})
