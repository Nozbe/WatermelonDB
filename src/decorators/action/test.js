import { MockTask, mockDatabase } from '../../__tests__/testModels'
import action from './index'

class MockTaskExtended extends MockTask {
  @action
  async returnArgs(a, b, ...c) {
    return [this.name, a, b, c]
  }

  @action
  async nested(...args) {
    return this.subAction(() => this.returnArgs('sub', ...args))
  }
}

describe('@action', () => {
  it('calls db.action() and passes arguments correctly', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })
    const record = new MockTaskExtended(tasks, { name: 'test' })

    const actionSpy = jest.spyOn(database, 'action')

    expect(await record.returnArgs(1, 2, 3, 4)).toEqual(['test', 1, 2, [3, 4]])

    expect(actionSpy).toHaveBeenCalledTimes(1)
    expect(actionSpy.mock.calls[0][0]).toBeInstanceOf(Function)
    expect(actionSpy.mock.calls[0][1]).toBe('mock_tasks.returnArgs')
  })
  it('can call subactions using this.subAction', async () => {
    const { tasks } = mockDatabase({ actionsEnabled: true })
    const record = new MockTaskExtended(tasks, { name: 'test' })

    expect(await record.nested(1, 2, 3, 4)).toEqual(['test', 'sub', 1, [2, 3, 4]])
  })
  it('works with arbitrary classes', async () => {
    const { database } = mockDatabase({ actionsEnabled: true })
    const actionSpy = jest.spyOn(database, 'action')
    class TestClass {
      database

      @action async test() {
        return 42
      }
    }

    const test = new TestClass()
    test.database = database

    expect(await test.test()).toEqual(42)
    expect(actionSpy).toHaveBeenCalledTimes(1)
  })
})
