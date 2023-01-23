// @flow

import { Key } from 'react'
import { $ObjMap } from '../../../types'

type UnpackPromise = <T>(promise: Promise<T>) => T

export default function allPromisesObj<T, Key, Spec = { [key: string | number]: Promise<T> }>(
  promisesObj: Spec,
): Promise<$ObjMap<Spec, UnpackPromise>>
