declare module '@nozbe/watermelondb/observation/observeIds' {
  import { Model, Query, RecordId } from '@nozbe/watermelondb'
  import { Observable } from 'rxjs'

  export default function observeIds<Record extends Model>(
    query: Query<Record>,
  ): Observable<RecordId[]>
}
