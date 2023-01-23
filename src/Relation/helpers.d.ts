import { type Observable } from '../utils/rx'

import type Relation from './index'
import type Model from '../Model'

export declare function createObservable<T extends Model>(relation: Relation<T>): Observable<T>
