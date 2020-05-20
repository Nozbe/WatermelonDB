/* eslint-disable */

import { NativeModules } from 'react-native'

const { appSchema, tableSchema } = require('../Schema')

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'test',
      columns: [
        { name: 'string', type: 'string' },
        { name: 'string2', type: 'string' },
        { name: 'string3', type: 'string' },
        { name: 'string4', type: 'string', isOptional: true },
        { name: 'string5', type: 'string' },
        { name: 'number', type: 'number', isIndexed: true },
        { name: 'boolean', type: 'boolean' },
      ],
    }),
  ],
})

function deepEqual(x, y) {
  const ok = Object.keys
  const tx = typeof x
  const ty = typeof y
  return x && y && tx === 'object' && tx === ty
    ? ok(x).length === ok(y).length && ok(x).every(key => deepEqual(x[key], y[key]))
    : x === y
}

const { encodeSchema } = require('../adapters/sqlite/encodeSchema')

const encodedSchema = encodeSchema(schema)

const size = 30000
const dataToBatch = [...Array(size).keys()].map(x => [
  'create',
  'test',
  `id${x}`,
  'insert into test (id, string, string2, string3, string4, string5, number, boolean) values (?, ?, ?, ?, ?, ?, ?, ?)',
  [
    `id${x}`,
    'foo',
    'foo',
    'Lorem ipsum dolor sit amet enim. Etiam ullamcorper. Suspendisse a pellentesque dui, non felis. Maecenas malesuada elit lectus felis, malesuada ultricies. Curabitur et ligula. Ut molestie a, ultricies porta urna. Vestibulum commodo volutpat a, convallis ac, laoreet enim. Phasellus fermentum in, dolor. Pellentesque facilisis. Nulla imperdiet sit amet magna. Vestibulum dapibus, mauris nec malesuada fames ac turpis velit, rhoncus eu, luctus et interdum adipiscing wisi. Aliquam erat ac ipsum. Integer aliquam purus. Quisque lorem tortor fringilla sed, vestibulum id, eleifend justo vel bibendum sapien massa ac turpis faucibus orci luctus non, consectetuer lobortis quis, varius in, purus. Integer ultrices posuere cubilia Curae, Nulla ipsum dolor lacus, suscipit adipiscing. Cum sociis natoque penatibus et ultrices volutpat. Nullam wisi ultricies a, gravida vitae, dapibus risus ante sodales lectus blandit eu, tempor diam pede cursus vitae, ultricies eu, faucibus quis, porttitor eros cursus lectus, pellentesque eget, bibendum a, gravida ullamcorper quam. Nullam viverra consectetuer. Quisque cursus et, porttitor risus. Aliquam sem. In hendrerit nulla quam nunc, accumsan congue. Lorem ipsum primis in nibh vel risus. Sed vel lectus. Ut sagittis, ipsum dolor quam.',
    null,
    'foo',
    3.14,
    1,
  ],
])

function invariant(condition, msg) {
  if (!condition) {
    throw new Error(msg)
  }
}

// NOTE: You can put stuff there to play around with Watermelon in development - useful for running
// native Tester projects via Xcode/Android Studio - when playing around in Jest environment won't do
// To use, set openPlayground=true in index.integrationTests.native.js
// WARN: DO NOT commit stuff put in here
async function runPlayground() {
  const dbname = 'file:jsitests?mode=memory&cache=shared'
  const newDb = global.nativeWatermelonCreateAdapter('file:jsitests?mode=memory&cache=shared')
  const initret = newDb.initialize(dbname, 1)
  newDb.setUpWithSchema(dbname, encodedSchema, 1)

  // ---
  await new Promise(resolve => setTimeout(resolve, 250))

  console.log(`Hello!`)
  const before = Date.now()
  newDb.batch(dataToBatch)
  console.log(`NEw method - added ${size} in ${Date.now() - before}ms`)

  // ---

  const dbname2 = 'file:jsitests2?mode=memory&cache=shared'
  await NativeModules.DatabaseBridge.initialize(1, dbname2, 1)
  await NativeModules.DatabaseBridge.setUpWithSchema(1, dbname2, encodedSchema, 1)

  await new Promise(resolve => setTimeout(resolve, 250))

  const beforeOld = Date.now()
  await NativeModules.DatabaseBridge.batch(1, dataToBatch)
  console.log(`Old method - added ${size} in ${Date.now() - beforeOld}ms`)

  await new Promise(resolve => setTimeout(resolve, 250))
  if (
    (await NativeModules.DatabaseBridge.count(1, 'select count(*) as count from test')) !== size
  ) {
    throw new Error('bad module!')
  }
}

runPlayground()
