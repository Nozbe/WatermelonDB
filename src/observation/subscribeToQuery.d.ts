declare module '@nozbe/watermelondb/observation/observeQuery' {
  import { Model, Query } from '@nozbe/watermelondb'
  import { Observable } from 'rxjs'

  export default function observeQuery<Record extends Model>(
    query: Query<Record>,
  ): Observable<Record[]>
}
