import * as React from 'react'
import * as TestRenderer from 'react-test-renderer'
import { Subject } from 'rxjs'
import { mockDatabase } from '../../__tests__/testModels'
import withObservables from './index'

describe('withObservables', () => {
  it('should hoist non react statics', () => {
    class A extends React.PureComponent {
      static nonReactProp = 'temp_string'
      render() {
        return null
      }
    }
    const getObservables = () => {}
    const WrappedComponent = withObservables([], getObservables)(A)
    expect(WrappedComponent.nonReactProp).toBe(A.nonReactProp)
  })
  it('renders a null prop without throwing, and re-renders when the record arrives', async () => {
    const { database, tasks } = mockDatabase()

    // eslint-disable-next-line react/prop-types
    const Task = ({ task }) => <span>{task ? `task:${task.id}` : 'missing'}</span>
    const EnhancedTask = withObservables(['taskId'], ({ taskId }) => ({
      task: tasks.observeRecord(taskId),
    }))(Task)

    let renderer
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(<EnhancedTask taskId="t1" />)
    })
    expect(renderer.root.findByType('span').children).toEqual(['missing'])

    await TestRenderer.act(async () => {
      await database.write(() =>
        tasks.create((task) => {
          task._raw.id = 't1'
        }),
      )
    })
    expect(renderer.root.findByType('span').children).toEqual(['task:t1'])

    await TestRenderer.act(async () => {
      await database.write(async () => {
        const task = await tasks.find('t1')
        await task.markAsDeleted()
      })
    })
    expect(renderer.root.findByType('span').children).toEqual(['missing'])

    renderer.unmount()
  })
  it('rethrows observable errors in render', () => {
    const subject = new Subject()
    const Base = () => <span>ok</span>
    const Enhanced = withObservables([], () => ({ value: subject }))(Base)
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      TestRenderer.act(() => {
        TestRenderer.create(<Enhanced />)
        subject.error(new Error('boom'))
      })
    }).toThrow('boom')
    consoleError.mockRestore()
  })
})
