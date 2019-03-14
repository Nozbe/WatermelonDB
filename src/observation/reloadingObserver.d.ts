declare module '@nozbe/watermelondb/observation/reloadingObserver' {
  import { Model, Query } from '@nozbe/watermelondb'
  import { Observable } from 'rxjs'

  export default function reloadingObserver<Record extends Model>(
    query: Query<Record>,
  ): Observable<Record[]>
}
