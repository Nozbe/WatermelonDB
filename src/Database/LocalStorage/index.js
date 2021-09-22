// @flow
import type Database from '..'
import { invariant } from '../../utils/common'

export opaque type LocalStorageKey<ValueType> = string

export function localStorageKey<ValueType>(name: string): LocalStorageKey<ValueType> {
  return name
}

export default class LocalStorage {
  _db: Database

  constructor(database: Database): void {
    this._db = database
  }

  // Get value from LocalStorage (returns value deserialized from JSON)
  // Returns `undefined` if not found
  async get<ValueType>(key: LocalStorageKey<ValueType>): Promise<ValueType | void> {
    const json = await this._db.adapter.getLocal(key)
    return json == null ? undefined : JSON.parse(json)
  }

  // Set value to LocalStorage
  // Only JSON-serializable values are allowed and well-behaved:
  // strings, numbers, booleans, and null; as well as arrays and objects only containing those
  //
  // Serializing other values will either throw an error (e.g. function passed) or be serialized
  // such that deserializing it won't yield an equal value (e.g. NaN to null, Dates to a string)
  // See details:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description
  async set<ValueType>(key: LocalStorageKey<ValueType>, value: ValueType): Promise<void> {
    const json = JSON.stringify(value)
    invariant(typeof json === 'string', 'Value not JSON-serializable')
    return this._db.adapter.setLocal(key, json)
  }

  async remove(key: LocalStorageKey<*>): Promise<void> {
    return this._db.adapter.removeLocal(key)
  }
}
