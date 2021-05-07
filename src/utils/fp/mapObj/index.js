// @flow
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */

type MapObj2 = <T, Key, Obj: { [Key]: T }, U, Fn: (T, Key, Obj) => U>(
  fn: Fn,
  obj: Obj,
) => $ObjMap<Obj, (T) => U>
type MapObjCur = <T, Key, Obj: { [Key]: T }, U, Fn: (T, Key, Obj) => U>(
  fn: Fn,
) => (Obj) => $ObjMap<Obj, (T) => U>
type MapObj = MapObj2 & MapObjCur

function mapObj(fn: (any, string, any) => any, obj: {}): any {
  if (arguments.length === 1) {
    // $FlowFixMe
    return (_obj) => mapObj(fn, _obj)
  }
  const result = {}
  for (const prop in obj) {
    result[prop] = fn(obj[prop], prop, obj)
  }
  return result
}

export default ((mapObj: any): MapObj)
