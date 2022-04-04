declare module '@BuildHero/watermelondb/observation/reloadingObserver' {
  import { Model, Query } from '@BuildHero/watermelondb'
  import { Observable } from 'rxjs'

  export default function reloadingObserver<Record extends Model>(
    query: Query<Record>,
  ): Observable<Record[]>
}
