declare module '@BuildHero/watermelondb/observation/observeCount' {
  import { Model, Query } from '@BuildHero/watermelondb'
  import { Observable } from 'rxjs'

  export default function observeCount<Record extends Model>(
    query: Query<Record>,
    isThrottled: boolean,
  ): Observable<number>
}
