declare module '@nozbe/watermelondb/Relation/helpers' {
  import { Model, Relation } from '@nozbe/watermelondb'
  import { Observable } from 'rxjs'

  export function getImmutableObservable<T extends Model | void>(
    relation: Relation<T>,
  ): Observable<T>

  export function getObservable<T extends Model | void>(relation: Relation<T>): Observable<T>

  export function createObservable<T extends Model | void>(relation: Relation<T>): Observable<T>
}
