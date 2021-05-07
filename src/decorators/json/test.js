import Model from '../../Model'

import { tableSchema } from '../../Schema'
import json from './index'
import field from '../field'

const schema = tableSchema({
  name: 'mock',
  columns: [{ name: 'extras', type: 'string', isOptional: true }],
})

const schema2 = tableSchema({
  name: 'mock',
  columns: [
    { name: 'kind', type: 'string' },
    { name: 'extras', type: 'string', isOptional: true },
  ],
})

const mockSanitizer = (storedValue) =>
  storedValue && Array.isArray(storedValue.elements)
    ? { elements: storedValue.elements }
    : { elements: [] }

const mockSanitizer2 = (storedValue, model) =>
  model.kind === 'A' ? { dataA: storedValue.dataA } : { dataB: storedValue.dataB }

class MockModel extends Model {
  static table = 'mock'

  @json('extras', mockSanitizer)
  extras
}

class MockModel2 extends Model {
  static table = 'mock'

  @json('extras', () => null)
  extras
}

class MockModel3 extends Model {
  static table = 'mock'

  @field('kind') kind

  @json('extras', mockSanitizer2)
  extras
}

describe('decorators/json', () => {
  it('deserializes value from JSON', () => {
    const model = new MockModel(
      { schema },
      { extras: '{"elements":[10,false,"foo",{"foo":"bar"}]}' },
    )
    expect(model.extras).toEqual({ elements: [10, false, 'foo', { foo: 'bar' }] })

    const model2 = new MockModel({ schema }, { extras: '-Infinity' })
    expect(model2.extras).toEqual({ elements: [] })

    const model3 = new MockModel({ schema }, { extras: null })
    expect(model3.extras).toEqual({ elements: [] })

    const model4 = new MockModel2({ schema }, { extras: { data: [1, 2, 3, 4] } })
    expect(model4.extras).toEqual(null)

    const model5 = new MockModel3({ schema2 }, { kind: 'A', extras: '{ "dataA": [1, 2, 3, 4] }' })
    expect(model5.extras).toEqual({ dataA: [1, 2, 3, 4] })

    const model6 = new MockModel3({ schema2 }, { kind: 'B', extras: '{ "dataB": [1, 2, 3, 4] }' })
    expect(model6.extras).toEqual({ dataB: [1, 2, 3, 4] })
  })
  it('serializes value to JSON', () => {
    const model = new MockModel({ schema }, {})
    model._isEditing = true

    model.extras = { elements: [true, 3.14, { bar: 'baz' }], otherValue: true }
    expect(model._getRaw('extras')).toBe('{"elements":[true,3.14,{"bar":"baz"}]}')

    model.extras = null
    expect(model._getRaw('extras')).toBe('{"elements":[]}')

    const model2 = new MockModel2({ schema }, {})
    model2._isEditing = true
    model2.extras = { data: [1, 2, 3, 4] }
    expect(model2._getRaw('extras')).toBe(null)
  })
  it('fails if applied to incorrect fields', () => {
    expect(
      () =>
        class {
          @json
          noName
        },
    ).toThrow('column name')
  })
})
