import { MockTask, mockDatabase } from '../../__tests__/testModels'
import field from './index'

describe('decorators/field', () => {
  it('delegates accesses to _getRaw/_setRaw', () => {
    const { tasks } = mockDatabase()
    const model = new MockTask(tasks, {})
    model._getRaw = jest.fn()
    model._setRaw = jest.fn()

    model.projectId
    model.projectId = 'xx'
    model.projectId
    model.projectId = 'bar'

    expect(model._getRaw).toHaveBeenCalledTimes(2)
    expect(model._getRaw).toHaveBeenCalledWith('project_id')
    expect(model._setRaw).toHaveBeenCalledTimes(2)
    expect(model._setRaw).toHaveBeenCalledWith('project_id', 'xx')
    expect(model._setRaw).toHaveBeenLastCalledWith('project_id', 'bar')
  })
  it('works with arbitrary objects with asModel', () => {
    const { tasks } = mockDatabase()
    const model = new MockTask(tasks, {})
    class ModelProxy {
      asModel = model

      @field('name') name
    }
    model._isEditing = true
    model.name = 'a'
    const proxy = new ModelProxy()
    expect(proxy.name).toBe('a')
    proxy.name = 'b'
    expect(model.name).toBe('b')
  })
  it('fails if applied to incorrect fields', () => {
    expect(
      () =>
        class {
          @field
          noName
        },
    ).toThrow('column name')
    expect(
      () =>
        class {
          @field()
          noName
        },
    ).toThrow('column name')
    expect(
      () =>
        class {
          @field('field_with_default_value')
          fieldWithDefaultValue = 'hey'
        },
    ).toThrow('properties with a default value')
    expect(
      () =>
        class {
          @field('getter')
          get someGetter() {
            return 'hey'
          }
        },
    ).toThrow('simple properties')
    expect(
      () =>
        class {
          @field('method')
          method() {}
        },
    ).toThrow('simple properties')
  })
})
