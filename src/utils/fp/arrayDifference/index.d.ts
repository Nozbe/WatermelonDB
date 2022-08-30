// @flow

import {$Exact} from '../../../types';

export type ArrayDiff<T> = $Exact<{ added: T[], removed: T[] }>

export default function <A, T = A>(previousList: T[], nextList: T[]): ArrayDiff<T>
