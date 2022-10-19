import type Database from '..'

export type LocalStorageKey<ValueType> = string

export function localStorageKey<ValueType>(name: string): LocalStorageKey<ValueType>

export default class LocalStorage {
  _db: Database

  constructor(database: Database)

  // Get value from LocalStorage (returns value deserialized from JSON)
  // Returns `undefined` if not found
  get<ValueType>(key: LocalStorageKey<ValueType>): Promise<ValueType | void>

  // Experimental: Same as get(), but can be called synchronously
  _getSync<ValueType>(
    key: LocalStorageKey<ValueType>,
    callback: (value: ValueType | void) => void,
  ): void

  // Set value to LocalStorage
  // Only JSON-serializable values are allowed and well-behaved:
  // strings, numbers, booleans, and null; as well as arrays and objects only containing those
  //
  // Serializing other values will either throw an error (e.g. function passed) or be serialized
  // such that deserializing it won't yield an equal value (e.g. NaN to null, Dates to a string)
  // See details:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description
  set<ValueType>(key: LocalStorageKey<ValueType>, value: ValueType): Promise<void>

  remove(key: LocalStorageKey<any>): Promise<void>
}
