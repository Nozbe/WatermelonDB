import Model from '../../Model'

import { tableSchema } from '../../Schema'
import text from './index'

const schema = tableSchema({
  name: 'mock',
  columns: [
    { name: 'string', type: 'string' },
    { name: 'string2', type: 'string', isOptional: true },
  ],
})

class MockModel extends Model {
  @text('string')
  string

  @text('string2')
  string2
}

describe('decorators/text', () => {
  it('trims strings when setting', () => {
    const model = new MockModel({ schema }, {})
    model._isEditing = true
    model.string = '   val2  '
    expect(model.string).toBe('val2')
  })
  it('converts non-strings to null', () => {
    const model = new MockModel({ schema }, {})
    model._isEditing = true
    model.string = 10
    expect(model.string).toBe('')
    model.string = false
    expect(model.string).toBe('')
    model.string = null
    expect(model.string).toBe('')
    model.string = undefined
    expect(model.string).toBe('')
    model.string = ''
    expect(model.string).toBe('')
    // nullable
    model.string2 = false
    expect(model.string2).toBe(null)
    model.string2 = null
    expect(model.string2).toBe(null)
    model.string2 = undefined
    expect(model.string2).toBe(null)
    model.string2 = ''
    expect(model.string2).toBe('')
  })
  it('fails if applied to incorrect fields', () => {
    expect(
      () =>
        class {
          @text
          noName
        },
    ).toThrow(/column name/)
  })
})
