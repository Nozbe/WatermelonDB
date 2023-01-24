import { $ObjMap } from '../../../types'

type MapObj2 = <T, Key, Obj = { [key: string]: T }, U = any, Fn = (_: T, __: Key, ___: Obj) => U>(
  fn: Fn,
  obj: Obj,
) => $ObjMap<Obj, (_: T) => U>
type MapObjCur = <T, Key, Obj = { [key: string]: T }, U = any, Fn = (_: T, __: Key, ___: Obj) => U>(
  fn: Fn,
) => (_: Obj) => $ObjMap<Obj, (__: T) => U>
type MapObj = MapObj2 & MapObjCur

declare function mapObj(fn: (a: any, b: string, c: any) => any, obj: {}): MapObj

export default mapObj
