import Model from '../../Model'
import field from './index'

class MockModel extends Model {
  @field('foo_bar')
  fooBar
}

describe('watermelondb/decorators/field', () => {
  it('delegates accesses to _getRaw/_setRaw', () => {
    const model = new MockModel({}, {})
    model._getRaw = jest.fn()
    model._setRaw = jest.fn()

    model.fooBar
    model.fooBar = 'xx'
    model.fooBar
    model.fooBar = 'bar'

    expect(model._getRaw).toHaveBeenCalledTimes(2)
    expect(model._getRaw).toBeCalledWith('foo_bar')
    expect(model._setRaw).toHaveBeenCalledTimes(2)
    expect(model._setRaw).toBeCalledWith('foo_bar', 'xx')
    expect(model._setRaw).lastCalledWith('foo_bar', 'bar')
  })
  it('fails if applied to incorrect fields', () => {
    expect(
      () =>
        class {
          @field
          noName
        },
    ).toThrowError(/column name/)
    expect(
      () =>
        class {
          @field()
          noName
        },
    ).toThrowError(/column name/)
    expect(
      () =>
        class {
          @field('field_with_default_value')
          fieldWithDefaultValue = 'hey'
        },
    ).toThrowError(/properties with a default value/)
    expect(
      () =>
        class {
          @field('getter')
          get someGetter() {
            return 'hey'
          }
        },
    ).toThrowError(/simple properties/)
    expect(
      () =>
        class {
          @field('method')
          method() {}
        },
    ).toThrowError(/simple properties/)
  })
})
