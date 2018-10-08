import { omit } from 'rambdax'

import { tableSchema } from '../Schema'
import { setRawSanitized, sanitizedRaw, nullValue } from './index'

const stringNull = ['', null]
const boolNull = [false, null]
const numberNull = [0, null]

// value - input, string/bool: [a, b] - expected outputs for a - required fields, b - optional fields
const expectedSanitizations = [
  { value: 'Hello', string: ['Hello', 'Hello'], bool: boolNull, number: numberNull },
  { value: '', string: ['', ''], bool: boolNull, number: numberNull },
  { value: 'true', string: ['true', 'true'], bool: boolNull, number: numberNull },
  { value: 'false', string: ['false', 'false'], bool: boolNull, number: numberNull },
  { value: '1', string: ['1', '1'], bool: boolNull, number: numberNull },
  { value: '0', string: ['0', '0'], bool: boolNull, number: numberNull },
  { value: 'NaN', string: ['NaN', 'NaN'], bool: boolNull, number: numberNull },
  { value: 1, string: stringNull, bool: [true, true], number: [1, 1] },
  { value: 0, string: stringNull, bool: [false, false], number: [0, 0] },
  { value: 3.14, string: stringNull, bool: boolNull, number: [3.14, 3.14] },
  { value: -3.14, string: stringNull, bool: boolNull, number: [-3.14, -3.14] },
  {
    value: 1532612920392,
    string: stringNull,
    bool: boolNull,
    number: [1532612920392, 1532612920392],
  },
  { value: true, string: stringNull, bool: [true, true], number: numberNull },
  { value: false, string: stringNull, bool: [false, false], number: numberNull },
  { value: NaN, string: stringNull, bool: boolNull, number: numberNull },
  { value: Infinity, string: stringNull, bool: boolNull, number: numberNull },
  { value: -Infinity, string: stringNull, bool: boolNull, number: numberNull },
  { value: null, string: stringNull, bool: boolNull, number: numberNull },
  { value: undefined, string: stringNull, bool: boolNull, number: numberNull },
  { value: {}, string: stringNull, bool: boolNull, number: numberNull },
  { value: [], string: stringNull, bool: boolNull, number: numberNull },
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
    { name: 'is_abandonned', type: 'bool' },
    { name: 'is_all_day', type: 'bool', isOptional: true },
  ],
})

describe('sanitizedRaw()', () => {
  it('can sanitize the whole raw', () => {
    const goodTask = {
      id: 'abcdef',
      _status: 'synced',
      _changed: '',
      last_modified: 1532612920392,
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
      last_modified: 1332612920392,
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
      last_modified: 1000 /* .1 */,
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
      last_modified: 1000,
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
  it('can create a valid raw from nothin', () => {
    const newRaw = sanitizedRaw({}, mockTaskSchema)
    expect(omit(['id'], newRaw)).toEqual({
      _status: 'created',
      _changed: '',
      last_modified: null,
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
  it('sanitizes id, _status, _changed, last_modified', () => {
    const schema2 = tableSchema({ name: 'test2', columns: [] })

    const validateId = raw => {
      expect(typeof raw.id).toBe('string')
      expect(raw.id).toHaveLength(16)
    }

    // if ID is missing or malformed, treat this as a new object
    const raw1 = sanitizedRaw({ _status: 'updated', _changed: 'a,b', last_modified: 1234 }, schema2)
    expect(omit(['id'], raw1)).toEqual({ _status: 'created', _changed: '', last_modified: null })
    validateId(raw1)

    const raw2 = sanitizedRaw(
      { id: null, _status: 'updated', _changed: 'a,b', last_modified: 1234 },
      schema2,
    )
    expect(omit(['id'], raw2)).toEqual({ _status: 'created', _changed: '', last_modified: null })
    validateId(raw2)

    // otherwise, just sanitize other fields
    const raw3 = sanitizedRaw(
      { id: 'i1', _status: '', _changed: 'a,b', last_modified: 1234 },
      schema2,
    )
    expect(raw3).toEqual({ id: 'i1', _status: 'created', _changed: 'a,b', last_modified: 1234 })

    const raw4 = sanitizedRaw(
      { id: 'i2', _status: 'deleted', _changed: true, last_modified: NaN },
      schema2,
    )
    expect(raw4).toEqual({ id: 'i2', _status: 'deleted', _changed: '', last_modified: null })
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

    // bool
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

    expectedSanitizations.forEach(({ value, string, bool, number }) => {
      expect(test(value, 'string')).toBe(string[0])
      expect(test(value, 'string', true)).toBe(string[1])

      expect(test(value, 'bool')).toBe(bool[0])
      expect(test(value, 'bool', true)).toBe(bool[1])

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
