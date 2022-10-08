import type Query from '../../Query'
import type Model from '../../Model'

import { Observable } from 'rxjs'

export default function observeCount<Record extends Model>(
  query: Query<Record>,
  isThrottled: boolean,
): Observable<number>
