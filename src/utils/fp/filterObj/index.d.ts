// @flow
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */

import { $Shape } from '../../../types'

type FilterObj2 = <T, Key, Obj = { [Key: string]: T }, Fn = (T, Key, Obj) => boolean>(
  fn: Fn,
  obj: Obj,
) => $Shape<Obj>
type FilterObjCur = <T, Key, Obj = { [Key: string]: T }, Fn = (T, Key, Obj) => boolean>(
  fn: Fn,
) => (Obj) => $Shape<Obj>

type FilterObj = FilterObj2 & FilterObjCur

declare function filterObj(): FilterObj

export default filterObj
