import { MockTask, mockDatabase } from '../../__tests__/testModels'
import { writer, reader } from './index'

class MockTaskExtended extends MockTask {
  @reader
  async returnArgs(a, b, ...c) {
    return [this.name, a, b, c]
  }

  @writer
  async nested(...args) {
    return this.subAction(() => this.returnArgs('sub', ...args))
  }
}

describe('@writer', () => {
  it('calls db.writer() and passes arguments correctly', async () => {
    const { database, tasks } = mockDatabase()
    const record = new MockTaskExtended(tasks, { name: 'test' })

    const spy = jest.spyOn(database, 'read')

    expect(await record.returnArgs(1, 2, 3, 4)).toEqual(['test', 1, 2, [3, 4]])

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Function)
    expect(spy.mock.calls[0][1]).toBe('mock_tasks.returnArgs')
  })
  it('can call subactions using this.subAction', async () => {
    const { tasks } = mockDatabase()
    const record = new MockTaskExtended(tasks, { name: 'test' })

    expect(await record.nested(1, 2, 3, 4)).toEqual(['test', 'sub', 1, [2, 3, 4]])
  })
  it('works with arbitrary classes', async () => {
    const { database } = mockDatabase()
    const spy = jest.spyOn(database, 'read')
    class TestClass {
      database

      @reader async test() {
        return 42
      }
    }

    const test = new TestClass()
    test.database = database

    expect(await test.test()).toEqual(42)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
