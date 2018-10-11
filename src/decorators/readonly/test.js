import Model from '../../Model'
import { field } from '..'

import { tableSchema } from '../../schema'
import readonly from './index'

const schema = tableSchema({ name: 'mock', columns: [{ name: 'test', type: 'string' }] })

describe('watermelondb/decorators/utils/readonly', () => {
  it('throws on attempt to call a setter of @readonly field', () => {
    class Mock extends Model {
      @readonly
      @field('test')
      test
    }
    const object = new Mock({ schema }, {})
    object.test
    expect(() => {
      object.test = 'foo'
    }).toThrow()
  })
  it('throws on attempt to set a new value to @readonly field', () => {
    class Mock extends Model {
      @readonly
      test = 'blah'
    }
    const object = new Mock({ schema }, {})
    object.test
    expect(() => {
      object.test = 'foo'
    }).toThrow()
  })
})
