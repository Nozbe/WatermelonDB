import { Observable } from 'rxjs/Observable';
export type RestrictArray<T> = T extends any[] ? T : []
export declare function useObservable<State, Inputs>(observable: Observable<State>, initialState: State, inputs: RestrictArray<Inputs>): State;
