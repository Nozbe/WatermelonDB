import {pipe, pickAll, prop} from 'rambdax'
import { mockDatabase } from '../../__tests__/testModels'

import Query from '../../Query'
import * as Q from '../../QueryDescription'

import subscribeToQueryWithSelect from './index'

const makeMock = (database, {name, position, isCompleted}) =>
  database.collections.get('mock_tasks').create(mock => {
    mock.name = name
    mock.position = position
    mock.isCompleted = isCompleted
  })

describe('subscribeToQueryWithSelect', () => {
  it('observes changes correctly', async () => {
    const { database } = mockDatabase()

    // insert a few models
    const m1 = await makeMock(database, {name: 'name_1', position: 1, isCompleted: false})
    const m2 = await makeMock(database, {name: 'name_2', position: 2, isCompleted: true})

    // start observing
    const selectColumns = ['name', 'is_completed']
    const query = new Query(
      database.collections.get('mock_tasks'),
      [Q.experimentalSelect(selectColumns), Q.where('position', 1)]
    )
    const observer = jest.fn()
    const unsubscribe = subscribeToQueryWithSelect(query, observer)

    // Reecord to raw result with selected columns
    const allCols = ['id'].concat(selectColumns)
    const toSelectedRaw = pipe(prop('_raw'), pickAll(allCols))

    // check initial matches
    await new Promise(process.nextTick) // give time to propagate
    expect(observer).toHaveBeenCalledWith([toSelectedRaw(m1)])

    // make some irrelevant changes (no emission)
    const m3 = await makeMock(database, {name: 'irrelevant', position: 2, isCompleted: false})
    await m1.update(mock => {
      mock.description = 'irrelevant description'
    })
    await m2.destroyPermanently()

    // add a matching record
    const m4 = await makeMock(database, {name: 'foo', position: 1, isCompleted: true})
    expect(observer).toHaveBeenCalledWith([m1, m4].map(toSelectedRaw))

    // change existing record to match
    await m3.update(mock => {
      mock.position = 1
    })
    expect(observer).toHaveBeenCalledWith([m1, m4, m3].map(toSelectedRaw))

    // change existing record to no longer match
    await m4.update(mock => {
      mock.position = 2
    })
    expect(observer).toHaveBeenCalledWith([m1, m3].map(toSelectedRaw))

    // change matching record in irrelevant ways (no emission)
    await m3.update()

    // remove matching record
    await m1.destroyPermanently()
    expect(observer).toHaveBeenCalledWith([m3].map(toSelectedRaw))

    // ensure no extra emissions
    unsubscribe()
    expect(observer).toHaveBeenCalledTimes(5)
  })
})
