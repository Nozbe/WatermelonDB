// @flow
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */

type FilterObj2 = <T, Key, Obj: { [Key]: T }, Fn: (T, Key, Obj) => boolean>(
  fn: Fn,
  obj: Obj,
) => $Shape<Obj>
type FilterObjCur = <T, Key, Obj: { [Key]: T }, Fn: (T, Key, Obj) => boolean>(
  fn: Fn,
) => (Obj) => $Shape<Obj>
type FilterObj = FilterObj2 & FilterObjCur

function filterObj(predicate: (any, any, any) => any, obj: {}): any {
  if (arguments.length === 1) {
    // $FlowFixMe
    return (_obj) => filterObj(predicate, _obj)
  }
  const result: { [string]: any } = {}
  let value
  for (const prop in obj) {
    value = obj[prop]
    if (predicate(value, prop, obj)) {
      result[prop] = value
    }
  }
  return result
}

export default ((filterObj: any): FilterObj)
