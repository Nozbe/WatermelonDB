import { mockDatabase } from '../../__tests__/testModels'
import LocalStorage from '.'

export const simpleMockDatabase = () => {
  const storage = {}
  return {
    storage,
    adapter: {
      getLocal(key) {
        return storage[key]
      },
      setLocal(key, value) {
        storage[key] = value
      },
      removeLocal(key) {
        delete storage[key]
      },
    },
  }
}

describe('LocalStorage', () => {
  it('implements CRUD operations and stores data as JSON', async () => {
    const db = simpleMockDatabase()
    const localStorage = new LocalStorage(db)

    // non-existing get
    expect(await localStorage.get('nonexisting')).toBe(undefined)

    // set
    await localStorage.set('test1', [1, 'foo', false])
    expect(db.storage.test1).toBe('[1,"foo",false]')

    // get json
    expect(await localStorage.get('test1')).toEqual([1, 'foo', false])

    // update
    await localStorage.set('test1', { hey: null })
    expect(db.storage.test1).toBe('{"hey":null}')

    // remove
    await localStorage.remove('test1')
    expect(db.storage.test1).toBe(undefined)
  })
  it(`can store all JSON-safe values`, async () => {
    const { db } = mockDatabase()
    const localStorage = new LocalStorage(db)
    const check = async (value) => {
      expect(await localStorage.get('tested_value')).toBe(undefined)
      await localStorage.set('tested_value', value)
      expect(await localStorage.get('tested_value')).toEqual(value)
      await localStorage.remove('tested_value')
    }
    await check('')
    await check('foo')
    await check(0)
    await check(3.14)
    await check(null)
    await check(true)
    await check(false)
    await check([])
    await check([-1, 0, 'foo', true, false, 3.14, null])
    await check({ foo: 'bar', a: [1, { x: null }] })
  })
  it(`oddball values are serialized as expected`, async () => {
    const { db } = mockDatabase()
    const localStorage = new LocalStorage(db)

    const check = async (valueStored, expected) => {
      expect(await localStorage.get('tested_value')).toBe(undefined)
      await localStorage.set('tested_value', valueStored)
      expect(await localStorage.get('tested_value')).toEqual(expected)
      await localStorage.remove('tested_value')
    }
    await check(NaN, null)
    await check(Infinity, null)
    const date = new Date()
    await check(date, date.toISOString())
    await check({ foo: undefined, bar: '', baz: null }, { bar: '', baz: null })
    await check([undefined, { foo: () => {} }], [null, {}])
  })
  it('throws if getting/setting invalid values', async () => {
    const db = simpleMockDatabase()
    const localStorage = new LocalStorage(db)

    const checkGet = async (value) => {
      db.storage.tested_value = value
      await expect(localStorage.get('tested_value')).rejects.toBeInstanceOf(Error)
    }
    const checkSet = async (value) => {
      await expect(localStorage.set('tested_value', value)).rejects.toBeInstanceOf(Error)
    }

    await checkGet('1/asd[];d')
    await checkGet({})

    await checkSet(undefined)
    await checkSet(() => {})
    const cyclic = {}
    cyclic.child = { cyclic }
    await checkSet(cyclic)
  })
})
