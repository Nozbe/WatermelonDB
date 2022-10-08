import type Query from '../Query'
import type Model from '../Model'

import { Observable } from 'rxjs'

export default function observeQuery<Record extends Model>(
  query: Query<Record>,
): Observable<Record[]>
