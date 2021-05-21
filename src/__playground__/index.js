/* eslint-disable */

import { NativeModules } from 'react-native'
import { Database } from '../Database'
import SQLiteAdapter from '../adapters/sqlite'
import AdapterCompat from '../adapters/compat'
import { sanitizedRaw } from '../RawRecord'
import { appSchema, tableSchema } from '../Schema'

// NOTE: You can put stuff there to play around with Watermelon in development - useful for running
// native Tester projects via Xcode/Android Studio - when playing around in Jest environment won't do
// To use, set openPlayground=true in index.integrationTests.native.js
// WARN: DO NOT commit stuff put in here
async function bench(jsi) {
  console.log('running bench. jsi ? ' + jsi)

  const testSchema = appSchema({
    version: 1,
    tables: [
      tableSchema({
        name: 'tasks',
        columns: [
          { name: 'author_id', type: 'string' },
          { name: 'order', type: 'number', isOptional: true },
          { name: 'created_at', type: 'number' },
          { name: 'is_followed', type: 'boolean' },
          { name: 'name', type: 'string' },
        ],
      }),
    ],
  })
  const adapter = new SQLiteAdapter({
    schema: testSchema,
    jsi,
    dbName: `playground_test_db_${jsi}`,
  })
  const ada = new AdapterCompat(adapter)
  await ada.initializingPromise
  await ada.unsafeResetDatabase()

  const records = []
  for (let i = 0; i < 20000; i++) {
    records.push(
      sanitizedRaw(
        {
          id: `t${i}`,
          author_id: 'acbdef',
          order: i % 2 ? null : 3.14,
          created_at: i * 1000,
          is_followed: i % 3,
          name: 'Lorem ipsum bla bla bla bla bla bla bla bla bla bla',
        },
        testSchema.tables.tasks,
      ),
    )
  }
  // console.log(records.length, records[0])

  let b4 = 0
  let log = `jsi: ${jsi}`

  await new Promise((resolve) => setTimeout(resolve, 150))

  b4 = Date.now()
  await ada.batch(records.map((rec) => ['create', 'tasks', rec]))
  log += `, adding: ${Date.now() - b4}`

  await new Promise((resolve) => setTimeout(resolve, 150))

  b4 = Date.now()
  await ada.batch(records.map((rec) => ['update', 'tasks', rec]))
  log += `, updating: ${Date.now() - b4}`

  await new Promise((resolve) => setTimeout(resolve, 150))

  b4 = Date.now()
  await ada.batch(records.map((rec) => ['markAsDeleted', 'tasks', rec.id]))
  log += `, marking: ${Date.now() - b4}`

  await new Promise((resolve) => setTimeout(resolve, 150))

  b4 = Date.now()
  await ada.batch(records.map((rec) => ['destroyPermanently', 'tasks', rec.id]))
  log += `, destroying: ${Date.now() - b4}`

  console.log(log)
  alert(log)
}

async function runPlayground() {
  await bench(false)
  await bench(true)
}

runPlayground()
