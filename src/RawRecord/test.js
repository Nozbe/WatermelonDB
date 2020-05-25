import { omit } from 'rambdax'

import { tableSchema } from '../Schema'
import { setRawSanitized, sanitizedRaw, nullValue } from './index'

const stringNull = ['', null]
const booleanNull = [false, null]
const numberNull = [0, null]

// value - input, value: [a, b] - expected outputs for a - required fields, b - optional fields
const expectedSanitizations = [
  { value: 'Hello', string: ['Hello', 'Hello'], boolean: booleanNull, number: numberNull },
  { value: '', string: ['', ''], boolean: booleanNull, number: numberNull },
  { value: 'true', string: ['true', 'true'], boolean: booleanNull, number: numberNull },
  { value: 'false', string: ['false', 'false'], boolean: booleanNull, number: numberNull },
  { value: '1', string: ['1', '1'], boolean: booleanNull, number: numberNull },
  { value: '0', string: ['0', '0'], boolean: booleanNull, number: numberNull },
  { value: 'NaN', string: ['NaN', 'NaN'], boolean: booleanNull, number: numberNull },
  { value: 1, string: stringNull, boolean: [true, true], number: [1, 1] },
  { value: 0, string: stringNull, boolean: [false, false], number: [0, 0] },
  { value: +0.0, string: stringNull, boolean: [false, false], number: [0, 0] },
  { value: -0.0, string: stringNull, boolean: [false, false], number: [0, 0] },
  { value: 3.14, string: stringNull, boolean: booleanNull, number: [3.14, 3.14] },
  { value: -3.14, string: stringNull, boolean: booleanNull, number: [-3.14, -3.14] },
  {
    value: 1532612920392,
    string: stringNull,
    boolean: booleanNull,
    number: [1532612920392, 1532612920392],
  },
  { value: true, string: stringNull, boolean: [true, true], number: numberNull },
  { value: false, string: stringNull, boolean: [false, false], number: numberNull },
  { value: NaN, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: Infinity, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: -Infinity, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: null, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: undefined, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: {}, string: stringNull, boolean: booleanNull, number: numberNull },
  {
    value: { __proto__: { value: 'Hello' } },
    string: stringNull,
    boolean: booleanNull,
    number: numberNull,
  },
  {
    value: { __proto__: { valueOf: () => 10 } },
    string: stringNull,
    boolean: booleanNull,
    number: numberNull,
  },
  { value: [], string: stringNull, boolean: booleanNull, number: numberNull },
]

const mockTaskSchema = tableSchema({
  name: 'mock_tasks',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'responsible_id', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
    { name: 'ended_at', type: 'number', isOptional: true },
    { name: 'project_position', type: 'number' },
    { name: 'priority_position', type: 'number', isOptional: true },
    { name: 'is_abandonned', type: 'boolean' },
    { name: 'is_all_day', type: 'boolean', isOptional: true },
  ],
})

describe('sanitizedRaw()', () => {
  it('can sanitize the whole raw', () => {
    const goodTask = {
      id: 'abcdef',
      _status: 'synced',
      _changed: '',
      name: 'My task',
      responsible_id: 'abcdef',
      created_at: 1632612920392,
      ended_at: null,
      priority_position: null,
      project_position: 78.4,
      is_abandonned: false,
      is_all_day: false,
    }

    expect(sanitizedRaw(goodTask, mockTaskSchema)).not.toBe(goodTask)
    expect(sanitizedRaw(goodTask, mockTaskSchema)).toEqual(goodTask)

    const goodTask2 = {
      id: 'abcdef2',
      _status: 'updated',
      _changed: 'foo,bar',
      name: 'My task 2',
      responsible_id: null,
      created_at: 1432612920392,
      ended_at: 1232612920392,
      priority_position: 12.4,
      project_position: -20.1,
      is_abandonned: true,
      is_all_day: null,
    }

    expect(sanitizedRaw(goodTask2, mockTaskSchema)).toEqual(goodTask2)

    const messyTask = {
      id: 'abcdef3',
      _status: 'created',
      _changed: null,
      last_modified: 1000 /* .1 */, // last_modified was removed
      name: '',
      created_at: 2018 /* .5 */,
      ended_at: 'NaN',
      project_position: null,
      $loki: 1024,
      new_field: 'wtf',
    }

    expect(sanitizedRaw(messyTask, mockTaskSchema)).toEqual({
      id: 'abcdef3',
      _status: 'created',
      _changed: '',
      name: '',
      responsible_id: null,
      created_at: 2018,
      ended_at: null,
      priority_position: null,
      project_position: 0,
      is_abandonned: false,
      is_all_day: null,
    })
  })
  it(`can create a valid raw from nothin'`, () => {
    const newRaw = sanitizedRaw({}, mockTaskSchema)
    expect(omit(['id'], newRaw)).toEqual({
      _status: 'created',
      _changed: '',
      name: '',
      responsible_id: null,
      created_at: 0,
      ended_at: null,
      priority_position: null,
      project_position: 0,
      is_abandonned: false,
      is_all_day: null,
    })
    expect(typeof newRaw.id).toBe('string')
    expect(newRaw.id).toHaveLength(16)
  })
  it('sanitizes id, _status, _changed', () => {
    const schema2 = tableSchema({ name: 'test2', columns: [] })

    const validateId = raw => {
      expect(typeof raw.id).toBe('string')
      expect(raw.id).toHaveLength(16)
    }

    // if ID is missing or malformed, treat this as a new object
    const raw1 = sanitizedRaw({ _status: 'updated', _changed: 'a,b' }, schema2)
    expect(omit(['id'], raw1)).toEqual({ _status: 'created', _changed: '' })
    validateId(raw1)

    const raw2 = sanitizedRaw({ id: null, _status: 'updated', _changed: 'a,b' }, schema2)
    expect(omit(['id'], raw2)).toEqual({ _status: 'created', _changed: '' })
    validateId(raw2)

    // otherwise, just sanitize other fields
    const raw3 = sanitizedRaw({ id: 'i1', _status: '', _changed: 'a,b' }, schema2)
    expect(raw3).toEqual({ id: 'i1', _status: 'created', _changed: 'a,b' })

    const raw4 = sanitizedRaw({ id: 'i2', _status: 'deleted', _changed: true }, schema2)
    expect(raw4).toEqual({ id: 'i2', _status: 'deleted', _changed: '' })
  })
  it('is safe against __proto__ tricks', async () => {
    // TODO: It's unclear to me if this is actually dangerous/exploitable...
    const expected = {
      _status: 'created',
      _changed: '',
      name: '',
      responsible_id: 'abcdef',
      created_at: 0,
      ended_at: null,
      priority_position: null,
      project_position: 0,
      is_abandonned: false,
      is_all_day: null,
    }
    const json = JSON.parse(`{"__proto__":{"name":"pwned"},"responsible_id":"abcdef"}`)
    const protoJson = sanitizedRaw(json, mockTaskSchema)
    expect({}.name).toBe(undefined)
    expect(Object.prototype.hasOwnProperty.call(protoJson, '__proto__')).toBe(false)
    // eslint-disable-next-line no-proto
    expect(protoJson.__proto__).toBe(undefined)
    expect(omit(['id'], protoJson)).toEqual(expected)

    const protoObj = sanitizedRaw(Object.assign({}, json), mockTaskSchema)
    expect({}.name).toBe(undefined)
    expect(Object.prototype.hasOwnProperty.call(protoObj, '__proto__')).toBe(false)
    // eslint-disable-next-line no-proto
    expect(protoObj.__proto__).toBe(undefined)
    expect(omit(['id'], protoObj)).toEqual(expected)
  })
})

describe('setRawSanitized()', () => {
  it('can set one value on a sanitized raw', () => {
    const raw = sanitizedRaw({}, mockTaskSchema)

    // ?string
    expect(raw.responsible_id).toBe(null)

    setRawSanitized(raw, 'responsible_id', 'abcdef', mockTaskSchema.columns.responsible_id)
    expect(raw.responsible_id).toBe('abcdef')

    setRawSanitized(raw, 'responsible_id', false, mockTaskSchema.columns.responsible_id)
    expect(raw.responsible_id).toBe(null)

    // boolean
    expect(raw.is_abandonned).toBe(false)

    setRawSanitized(raw, 'is_abandonned', true, mockTaskSchema.columns.is_abandonned)
    expect(raw.is_abandonned).toBe(true)

    setRawSanitized(raw, 'is_abandonned', 0, mockTaskSchema.columns.is_abandonned)
    expect(raw.is_abandonned).toBe(false)

    setRawSanitized(raw, 'is_abandonned', 1, mockTaskSchema.columns.is_abandonned)
    expect(raw.is_abandonned).toBe(true)
  })
  it('can sanitize every value correctly', () => {
    const test = (value, type, isOptional = false) => {
      const raw = {}
      setRawSanitized(raw, 'foo', value, { name: 'foo', type, isOptional })
      return raw.foo
    }

    expectedSanitizations.forEach(({ value, string, boolean, number }) => {
      expect(test(value, 'string')).toBe(string[0])
      expect(test(value, 'string', true)).toBe(string[1])

      expect(test(value, 'boolean')).toBe(boolean[0])
      expect(test(value, 'boolean', true)).toBe(boolean[1])

      expect(test(value, 'number')).toBe(number[0])
      expect(test(value, 'number', true)).toBe(number[1])
    })
  })
})

describe('nullValue()', () => {
  it('can return null value for any column schema', () => {
    expect(nullValue({ name: 'foo', type: 'string' })).toBe('')
    expect(nullValue({ name: 'foo', type: 'string', isOptional: true })).toBe(null)
    expect(nullValue({ name: 'foo', type: 'number' })).toBe(0)
    expect(nullValue({ name: 'foo', type: 'number', isOptional: true })).toBe(null)
    expect(nullValue({ name: 'foo', type: 'boolean' })).toBe(false)
    expect(nullValue({ name: 'foo', type: 'boolean', isOptional: true })).toBe(null)
  })
})
