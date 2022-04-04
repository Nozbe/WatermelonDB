declare module '@BuildHero/watermelondb/observation/observeQuery' {
  import { Model, Query } from '@BuildHero/watermelondb'
  import { Observable } from 'rxjs'

  export default function observeQuery<Record extends Model>(
    query: Query<Record>,
  ): Observable<Record[]>
}
