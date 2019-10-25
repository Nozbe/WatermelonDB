import { NativeModules } from 'react-native'

const { appSchema, tableSchema } = require('./Schema')

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'test',
      columns: [
        { name: 'string', type: 'string' },
        { name: 'string2', type: 'string' },
        { name: 'string3', type: 'string' },
        { name: 'string4', type: 'string' },
        { name: 'string5', type: 'string' },
        { name: 'number', type: 'number' },
        { name: 'boolean', type: 'boolean' },
      ],
    }),
  ],
})

const { encodeSchema } = require('./adapters/sqlite/encodeSchema')

const encodedSchema = encodeSchema(schema)

async function runTests() {
  const dbname = 'file:jsitests?mode=memory&cache=shared'
  await NativeModules.DatabaseBridge.initialize(0, dbname, 1)
  await NativeModules.DatabaseBridge.setUpWithSchema(0, dbname, encodedSchema, 1)
  console.log(`Hello!`)
  console.log(global.nativeWatermelonDatabase)
  // global.nativeWatermelonBatch([
  //   [
  //     'create',
  //     'test',
  //     'abcdef',
  //     'insert into test (string, number, boolean) values (?, ?, ?)',
  //     ['foo', 3.14, 1],
  //   ],
  // ])
}

runTests()
