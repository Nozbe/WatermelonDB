/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import type { Observable } from '../utils/rx'

import type Model from '../Model'
import type Relation from './index'

export declare function createObservable<T extends Model>(relation: Relation<T>): Observable<T>
