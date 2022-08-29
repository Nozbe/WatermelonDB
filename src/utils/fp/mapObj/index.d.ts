// @flow
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */

import {$ObjMap} from '../../../types';

type MapObj2 = <T, Key, Obj = { [key:string]: T }, U = any, Fn = (T, Key, Obj) => U>(
  fn: Fn,
  obj: Obj,
) => $ObjMap<Obj, (T) => U>
type MapObjCur = <T, Key, Obj = { [key:string]: T }, U = any, Fn = (T, Key, Obj) => U>(
  fn: Fn,
) => (Obj) => $ObjMap<Obj, (T) => U>
type MapObj = MapObj2 & MapObjCur

declare function mapObj(fn: (a: any, b: string, c: any) => any, obj: {}): MapObj

export default mapObj
