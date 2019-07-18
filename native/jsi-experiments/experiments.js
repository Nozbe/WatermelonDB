NativeModules.MelonModule.initializeJSI()

// console.warn(global.melonModule.getInt())
// console.warn(global.melonModule.getDouble())
// console.warn(global.melonModule.multiply(3.14, 2.1))
// global.melonModule.nativeLog('ąśćąśß')

const t = Math.round(Math.random() * 1000)
const to = Math.round(Math.random() * 1000)

const callMelon = (tag, fn, ...args) => {
  return new Promise((resolve, reject) => {
    global.melonModule[fn](
      tag,
      ...args,
      (...params) => {
        // console.warn(`success ${fn}`, ...params)
        resolve(...params)
      },
      (...params) => {
        // console.error(`error ${fn}`, ...params)
        reject(...params)
      },
    )
  })
}

const dataToBatch = [...Array(5000).keys()].map(x => [
  'create',
  'test',
  `id${x}`,
  'insert into test (id, string, string2, string3, string4, string5, number, boolean) values (?, ?, ?, ?, ?, ?, ?, ?)',
  [
    `id${x}`,
    'foo',
    'foo',
    'Lorem ipsum dolor sit amet enim. Etiam ullamcorper. Suspendisse a pellentesque dui, non felis. Maecenas malesuada elit lectus felis, malesuada ultricies. Curabitur et ligula. Ut molestie a, ultricies porta urna. Vestibulum commodo volutpat a, convallis ac, laoreet enim. Phasellus fermentum in, dolor. Pellentesque facilisis. Nulla imperdiet sit amet magna. Vestibulum dapibus, mauris nec malesuada fames ac turpis velit, rhoncus eu, luctus et interdum adipiscing wisi. Aliquam erat ac ipsum. Integer aliquam purus. Quisque lorem tortor fringilla sed, vestibulum id, eleifend justo vel bibendum sapien massa ac turpis faucibus orci luctus non, consectetuer lobortis quis, varius in, purus. Integer ultrices posuere cubilia Curae, Nulla ipsum dolor lacus, suscipit adipiscing. Cum sociis natoque penatibus et ultrices volutpat. Nullam wisi ultricies a, gravida vitae, dapibus risus ante sodales lectus blandit eu, tempor diam pede cursus vitae, ultricies eu, faucibus quis, porttitor eros cursus lectus, pellentesque eget, bibendum a, gravida ullamcorper quam. Nullam viverra consectetuer. Quisque cursus et, porttitor risus. Aliquam sem. In hendrerit nulla quam nunc, accumsan congue. Lorem ipsum primis in nibh vel risus. Sed vel lectus. Ut sagittis, ipsum dolor quam.',
    'foo',
    'foo',
    1,
    true,
  ],
])

const dbname = `file:testdb${t}?mode=memory&cache=shared`
const dbname2 = `file:testdb${to}?mode=memory&cache=shared`
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

const { encodeSchema } = require('@nozbe/watermelondb/adapters/sqlite/encodeSchema')

const encodedSchema = encodeSchema(schema)

const jsipoker = setInterval(() => {}, 1)

const melonTests = async () => {
  // const [, time] = await devMeasureTimeAsync(async () => {
  const time1 = new Date()
  await callMelon(t, 'initialize', dbname, 1)
  await callMelon(t, 'setUpWithSchema', dbname, encodedSchema, 1)
  // await callMelon(t, 'find', 'test', 'id1')
  // await callMelon(t, 'query', 'test', 'select * from test')
  await callMelon(t, 'batch', dataToBatch)
  // await callMelon(t + 1, 'initialize', dbname, 1)
  // await callMelon(t + 1, 'find', 'test', 'id1')
  // await callMelon(t + 2, 'initialize', dbname, 1)
  // const query = await callMelon(t + 2, 'query', 'test', 'select * from test')
  const query = {}
  const time2 = new Date()
  // console.warn(`New method. check: ${query.length}, time: ${time2 - time1}`)
  // })

  // console.warn(`New method. Time: ${time}`)
  const OldBridge = NativeModules.DatabaseBridge
  const [, time3] = await devMeasureTimeAsync(async () => {
    await OldBridge.initialize(to, dbname2, 1)
    await OldBridge.setUpWithSchema(to, dbname2, encodedSchema, 1)
    await OldBridge.batch(to, dataToBatch)
    await OldBridge.initialize(to + 2, dbname2, 1)
    // const query = await OldBridge.query(to + 2, 'test', 'select * from test')
    // console.warn(`Old method. Query check: ${query.length}`)
  })
  // console.warn(`Old method. Time: ${time3}`)

  await devAlert(`Old: ${time3}, new: ${time2 - time1}`)

  clearInterval(jsipoker)
}
