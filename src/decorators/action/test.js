import { MockTask, mockDatabase } from '../../__tests__/testModels'
import action from './index'

class MockTaskExtended extends MockTask {
  @action
  async returnArgs(a, b, ...c) {
    return [this.name, a, b, c]
  }
}

describe('@action', () => {
  it('calls db.action() and passes arguments correctly', async () => {
    const { database, tasksCollection } = mockDatabase({ actionsEnabled: true })
    const record = new MockTaskExtended(tasksCollection, { name: 'test' })

    const actionSpy = jest.spyOn(database, 'action')

    expect(await record.returnArgs(1, 2, 3, 4)).toEqual(['test', 1, 2, [3, 4]])

    expect(actionSpy).toHaveBeenCalledTimes(1)
    expect(actionSpy.mock.calls[0][0]).toBeInstanceOf(Function)
    expect(actionSpy.mock.calls[0][1]).toBe('mock_tasks.returnArgs')
  })
})
