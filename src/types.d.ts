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
