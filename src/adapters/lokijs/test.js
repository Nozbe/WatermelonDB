import { makeMockTask, testSchema } from 'adapters/__tests__/helpers'
import commonTests from 'adapters/__tests__/commonTests'

import LokiJSAdapter from 'adapters/lokijs'

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
  it('does not return any Loki junk', async () => {
    const adapter = newAdapter()
    const record = makeMockTask({ id: 'abc', foo: 'bar' })

    await adapter.batch([['CREATE', record]])
    expect(record._raw.$loki).toBeUndefined()
  })
})
