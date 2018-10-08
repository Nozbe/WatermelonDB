import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

import LokiJSAdapter from './index'

const newAdapter = () =>
  new LokiJSAdapter({
    dbName: 'test',
    schema: testSchema,
  })

describe('watermelondb/adapters/lokijs', () => {
  commonTests().forEach(testCase => {
    const [name, test] = testCase
    const adapter = newAdapter()
    it(name, test(adapter, LokiJSAdapter))
  })
})
