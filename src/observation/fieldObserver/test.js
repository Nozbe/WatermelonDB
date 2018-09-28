import { Subject } from 'rxjs/Subject'
import { mockDatabase } from '../../__tests__/testModels'
import fieldObserver from './index'

const makeDatabase = () => {
  // TODO: Change test to actually go through the DB
  const { database } = mockDatabase()

  database.adapter = {
    batch: jest.fn(),
  }

  return database
}

const mockTask = (database, name, isCompleted, position) =>
  database.collections.get('mock_tasks').create(mock => {
    mock.name = name
    mock.isCompleted = isCompleted
    mock.position = position
  })

describe('watermelondb/observation/fieldObserver', () => {
  it('observes changes correctly', async () => {
    const database = makeDatabase()

    // start observing
    const source = new Subject()
    const observer = jest.fn()
    const subscription = fieldObserver(source, ['is_completed', 'position']).subscribe(observer)

    // start with a few matching models
    const m1 = await mockTask(database, 'name1', false, 10)
    const m2 = await mockTask(database, 'name2', false, 20)
    source.next([m1, m2])
    expect(observer).toBeCalledWith([m1, m2])
    expect(observer).toHaveBeenCalledTimes(1)

    // add matches, remove matches
    const m3 = await mockTask(database, 'name3', false, 30)
    source.next([m2, m3])
    expect(observer).toBeCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(2)

    // make some irrelevant changes (no emission)
    await m3.update(mock => {
      mock.name = 'changed name'
    })
    expect(observer).toHaveBeenCalledTimes(2)

    // change a relevant field
    await m3.update(mock => {
      mock.position += 1
    })
    expect(observer).toBeCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(3)

    // change another relevant field
    await m2.update(mock => {
      mock.isCompleted = true
    })

    expect(observer).toBeCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(4)

    // change a relevant field in a previously-observed record (no emission)
    await m1.update(mock => {
      mock.position += 1
    })
    expect(observer).toHaveBeenCalledTimes(4)

    // ensure record subscriptions are disposed properly
    source.complete()
    await m2.update(mock => {
      mock.position += 1
    })
    await m3.update(mock => {
      mock.position += 1
    })
    subscription.unsubscribe()
    expect(observer).toHaveBeenCalledTimes(4)
  })
})
