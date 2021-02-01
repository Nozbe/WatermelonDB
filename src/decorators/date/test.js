import Model from '../../Model'

import { tableSchema } from '../../Schema'
import date from './index'

const schema = tableSchema({
  name: 'mock',
  columns: [{ name: 'date', type: 'number', isOptional: true }],
})

class MockModel extends Model {
  static table = 'mock'

  @date('date')
  date
}

describe('decorators/timestamp', () => {
  it('returns timestamps cast to Date', () => {
    const model = new MockModel({ schema }, { date: 1400000000000 })
    expect(model.date).toBeInstanceOf(Date)
    expect(+model.date).toBe(1400000000000)
  })
  it('returns null if raw field is null', () => {
    const model = new MockModel({ schema }, { date: null })
    expect(model.date).toBe(null)
  })
  it('sets timestamps cast from dates', () => {
    const model = new MockModel({ schema }, {})
    model._isEditing = true
    model.date = Date.now()
    expect(model._getRaw('date')).toBeGreaterThan(1500000000000)
  })
  it('sets null if passed', () => {
    const model = new MockModel({ schema }, {})
    model._isEditing = true
    model.date = null
    expect(model._getRaw('date')).toBe(null)
  })
  it('returns 1970 date, not null if timestamp=0', () => {
    const model = new MockModel({ schema }, { date: 0 })
    expect(model.date).toBeInstanceOf(Date)
    expect(+model.date).toBe(0)
  })
  it('sets 1970 date, not null if timestamp', () => {
    const model = new MockModel({ schema }, {})
    model._isEditing = true
    model.date = new Date(0)
    expect(model._getRaw('date')).toBe(0)
    expect(+model.date).toBe(0)
  })
  it('fails if applied to incorrect fields', () => {
    expect(
      () =>
        class {
          @date
          noName
        },
    ).toThrow(/column name/)
  })
  it('returns a instance of date if cached', () => {
    const model = new MockModel({ schema }, { date: 0 })
    expect(model.date).toBeInstanceOf(Date)
    model._isEditing = true
    model.date = '2011-10-05T14:48:00.000Z'
    expect(model.date).toBeInstanceOf(Date)
  })
})
