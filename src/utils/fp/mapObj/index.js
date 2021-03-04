// @flow

type MapObj2 = <T, Obj: { [string]: T }, U, Fn: (T, string, Obj) => U>(fn: Fn, obj: Obj) => $ObjMap<Obj, Fn>
type MapObjCur = <T, Obj: { [string]: T }, U, Fn: (T, string, Obj) => U>(fn: Fn) => (Obj => $ObjMap<Obj, Fn>)
type MapObj = MapObj2 & MapObjCur

function mapObj(fn: (any, any, any) => any, obj: {}): any {
  if (arguments.length === 1) {
    // $FlowFixMe
    return obj => mapObj(fn, obj)
  }
  const result = {}
  for (let prop in obj) {
    result[prop] = fn(obj[prop], prop, obj)
  }
  return result
}

export default ((mapObj: any): MapObj)
