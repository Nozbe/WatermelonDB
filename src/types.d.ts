export type $Shape<T> = T

export type $NonMaybeType<T> = T

export type $ObjMap<O, T> = { [K in keyof O]: T }

export type $Exact<Type> = Type

export type $RE<Type> = Readonly<$Exact<Type>>

export type $Keys<Type> = { k: keyof Type }

export type Array<Type> = Type[]

// TODO: FIX TS
export type $Call<F, T> = any

export type $ReadOnlyArray<T> = T[]

export type RequireKey<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

export type IsOptional<T> = Exclude<T, string | number | boolean> extends never ? false : true

// Assumes that arrays and objects will be stored as json strings
export type GetType<T> = T extends string
  ? 'string'
  : T extends number
  ? 'number'
  : T extends boolean
  ? 'boolean'
  : 'string'
