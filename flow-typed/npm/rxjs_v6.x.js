type rxjs$PartialObserver<-T> =
  | {
      +next: (value: T) => mixed,
      +error?: (error: any) => mixed,
      +complete?: () => mixed
    }
  | {
      +next?: (value: T) => mixed,
      +error: (error: any) => mixed,
      +complete?: () => mixed
    }
  | {
      +next?: (value: T) => mixed,
      +error?: (error: any) => mixed,
      +complete: () => mixed
    };

declare interface rxjs$ISubscription {
  unsubscribe(): void;
}

type rxjs$TeardownLogic = rxjs$ISubscription | (() => void);

type rxjs$EventListenerOptions =
  | {
      capture?: boolean,
      passive?: boolean,
      once?: boolean
    }
  | boolean;

type rxjs$ObservableInput<T> = rxjs$Observable<T> | Promise<T> | Iterable<T>;

type rxjs$OperatorFunction<T, R> = (rxjs$Observable<T>) => rxjs$Observable<R>;
type rxjs$OperatorFunctionLast<T, R: rxjs$Observable<*>> = (
  rxjs$Observable<T>
) => R;

declare class rxjs$Observable<+T> {
  static create(
    subscribe: (
      observer: rxjs$Observer<T>
    ) => rxjs$ISubscription | Function | void
  ): rxjs$Observable<T>;

  let<U>(
    project: (self: rxjs$Observable<T>) => rxjs$Observable<U>
  ): rxjs$Observable<U>;

  observeOn(scheduler: rxjs$SchedulerClass): rxjs$Observable<T>;

  pipe(): rxjs$Observable<T>;

  pipe<A>(op1: rxjs$OperatorFunctionLast<T, A>): A;

  pipe<A, B>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunctionLast<A, B>
  ): B;

  pipe<A, B, C>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunctionLast<B, C>
  ): C;

  pipe<A, B, C, D>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunctionLast<C, D>
  ): D;

  pipe<A, B, C, D, E>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunction<C, D>,
    op5: rxjs$OperatorFunctionLast<D, E>
  ): E;

  toArray(): rxjs$Observable<T[]>;

  toPromise(): Promise<T>;

  subscribe(observer: rxjs$PartialObserver<T>): rxjs$Subscription;
  subscribe(
    onNext: ?(value: T) => mixed,
    onError: ?(error: any) => mixed,
    onCompleted: ?() => mixed
  ): rxjs$Subscription;

  _subscribe(observer: rxjs$Subscriber<T>): rxjs$Subscription;

  _isScalar: boolean;
  source: ?rxjs$Observable<any>;
  operator: ?rxjs$Operator<any, any>;
}

declare module 'rxjs/observable/bindCallback' {
  declare module.exports: {
    bindCallback(
      callbackFunc: (callback: (_: void) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<void>;
    bindCallback<U>(
      callbackFunc: (callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<U>;
    bindCallback<T, U>(
      callbackFunc: (v1: T, callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T) => rxjs$Observable<U>;
    bindCallback<T, T2, U>(
      callbackFunc: (v1: T, v2: T2, callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, U>(
      callbackFunc: (v1: T, v2: T2, v3: T3, callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        callback: (result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        callback: (result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, T6, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        v6: T6,
        callback: (result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5, v6: T6) => rxjs$Observable<U>;
    bindCallback<U>(
      callbackFunc: (callback: (...args: Array<any>) => any) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<U>;
    bindCallback<T, U>(
      callbackFunc: (v1: T, callback: (...args: Array<any>) => any) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T) => rxjs$Observable<U>;
    bindCallback<T, T2, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, T6, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        v6: T6,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5, v6: T6) => rxjs$Observable<U>;
    bindCallback<T>(
      callbackFunc: Function,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (...args: Array<any>) => rxjs$Observable<T>;
    bindCallback<T>(
      callbackFunc: Function,
      selector?: (...args: Array<any>) => T,
      scheduler?: rxjs$SchedulerClass
    ): (...args: Array<any>) => rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/bindNodeCallback' {
  declare module.exports: {
    bindNodeCallback<U>(
      callbackFunc: (callback: (err: any, result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<U>;
    bindNodeCallback<T, U>(
      callbackFunc: (v1: T, callback: (err: any, result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T) => rxjs$Observable<U>;
    bindNodeCallback<T, T2, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        callback: (err: any, result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2) => rxjs$Observable<U>;
    bindNodeCallback<T, T2, T3, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        callback: (err: any, result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3) => rxjs$Observable<U>;
    bindNodeCallback<T, T2, T3, T4, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        callback: (err: any, result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4) => rxjs$Observable<U>;
    bindNodeCallback<T, T2, T3, T4, T5, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        callback: (err: any, result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5) => rxjs$Observable<U>;
    bindNodeCallback<T, T2, T3, T4, T5, T6, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        v6: T6,
        callback: (err: any, result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5, v6: T6) => rxjs$Observable<U>;
    bindNodeCallback<T>(
      callbackFunc: Function,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (...args: Array<any>) => rxjs$Observable<T>;
    bindNodeCallback<T>(
      callbackFunc: Function,
      selector?: (...args: Array<any>) => T,
      scheduler?: rxjs$SchedulerClass
    ): (...args: Array<any>) => rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/combineLatest' {
  declare module.exports: {
    combineLatest: (<A, B>(
      a: rxjs$Observable<A>,
      resultSelector: (a: A) => B
    ) => rxjs$Observable<B>) &
    (<A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      resultSelector: (a: A, b: B) => C
    ) => rxjs$Observable<C>) &
    (<A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      resultSelector: (a: A, b: B, c: C) => D
    ) => rxjs$Observable<D>) &
    (<A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      resultSelector: (a: A, b: B, c: C, d: D) => E
    ) => rxjs$Observable<E>) &
    (<A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E) => F
    ) => rxjs$Observable<F>) &
    (<A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E, f: F) => G
    ) => rxjs$Observable<G>) &
    (<A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H
    ) => rxjs$Observable<H>) &
    (<A>(a: rxjs$Observable<A>, _: void) => rxjs$Observable<[A]>) &
    (<A, B>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      _: void
    ) => rxjs$Observable<[A, B]>) &
    (<A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      _: void
    ) => rxjs$Observable<[A, B, C]>) &
    (<A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      _: void
    ) => rxjs$Observable<[A, B, C, D]>) &
    (<A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      _: void
    ) => rxjs$Observable<[A, B, C, D, E]>) &
    (<A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      _: void
    ) => rxjs$Observable<[A, B, C, D, E, F]>) &
    (<A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      _: void
    ) => rxjs$Observable<[A, B, C, D, E, F, G]>) &
    (<A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      h: rxjs$Observable<H>,
      _: void
    ) => rxjs$Observable<[A, B, C, D, E, F, G, H]>);
  }
}
declare module 'rxjs/observable/concat' {
  declare module.exports: {
    concat<+T>(...sources: rxjs$Observable<T>[]): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/defer' {
  declare module.exports: {
    defer<+T>(
      observableFactory: () => rxjs$Observable<T> | Promise<T>
    ): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/empty' {
  declare module.exports: {
    empty<U>(): rxjs$Observable<U>;
  }
}
declare module 'rxjs/observable/forkJoin' {
  declare module.exports: {
    forkJoin<A, B>(
      a: rxjs$Observable<A>,
      resultSelector: (a: A) => B
    ): rxjs$Observable<B>;

    forkJoin<A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      resultSelector: (a: A, b: B) => C
    ): rxjs$Observable<C>;

    forkJoin<A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      resultSelector: (a: A, b: B, c: C) => D
    ): rxjs$Observable<D>;

    forkJoin<A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      resultSelector: (a: A, b: B, c: C, d: D) => E
    ): rxjs$Observable<E>;

    forkJoin<A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E) => F
    ): rxjs$Observable<F>;

    forkJoin<A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E, f: F) => G
    ): rxjs$Observable<G>;

    forkJoin<A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H
    ): rxjs$Observable<H>;

    forkJoin<A, B>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      _: void
    ): rxjs$Observable<[A, B]>;

    forkJoin<A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      _: void
    ): rxjs$Observable<[A, B, C]>;

    forkJoin<A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      _: void
    ): rxjs$Observable<[A, B, C, D]>;

    forkJoin<A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E]>;

    forkJoin<A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E, F]>;

    forkJoin<A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E, F, G]>;

    forkJoin<A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      h: rxjs$Observable<H>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E, F, G, H]>;

    forkJoin<A>(
      a: Array<rxjs$Observable<A>>,
      _: void
    ): rxjs$Observable<Array<A>>;

    forkJoin<A>(
      a: Array<rxjs$Observable<any>>,
      _: void
    ): rxjs$Observable<A>;

    forkJoin<A, B>(
      a: Array<rxjs$Observable<A>>,
      resultSelector: (...values: Array<A>) => B
    ): rxjs$Observable<B>;

    forkJoin<A>(
      a: Array<rxjs$Observable<any>>,
      resultSelector: (...values: Array<any>) => A
    ): rxjs$Observable<A>;
  }
}
declare module 'rxjs/observable/from' {
  declare module.exports: {
    from<+T>(
      input: rxjs$ObservableInput<T>,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/fromPromise' {
  declare module.exports: {
    fromPromise<+T>(promise: Promise<T>): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/fromEvent' {
  declare module.exports: {
    fromEvent<+T>(
      element: any,
      eventName: string,
      ...none: Array<void>
    ): rxjs$Observable<T>;
    fromEvent<+T>(
      element: any,
      eventName: string,
      options: rxjs$EventListenerOptions,
      ...none: Array<void>
    ): rxjs$Observable<T>;
    fromEvent<+T>(
      element: any,
      eventName: string,
      selector: () => T,
      ...none: Array<void>
    ): rxjs$Observable<T>;
    fromEvent<+T>(
      element: any,
      eventName: string,
      options: rxjs$EventListenerOptions,
      selector: () => T
    ): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/fromEventPattern' {
  declare module.exports: {
    fromEventPattern<+T>(
      addHandler: (handler: (item: T) => void) => void,
      removeHandler: (handler: (item: T) => void) => void,
      selector?: () => T
    ): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/generate' {
  declare module.exports: {
    // TODO
  }
}
declare module 'rxjs/observable/iif' {
  declare module.exports: {
    // TODO
  }
}
declare module 'rxjs/observable/interval' {
  declare module.exports: {
    interval(period: number): rxjs$Observable<number>;
  }
}
declare module 'rxjs/observable/merge' {
  declare module.exports: {
    merge: (<+T, U>(
      source0: rxjs$Observable<T>,
      source1: rxjs$Observable<U>
    ) => rxjs$Observable<T | U>) &
    (<+T, U, V>(
      source0: rxjs$Observable<T>,
      source1: rxjs$Observable<U>,
      source2: rxjs$Observable<V>
    ) => rxjs$Observable<T | U | V>) &
    (<+T>(...sources: rxjs$Observable<T>[]) => rxjs$Observable<T>)
  }
}
declare module 'rxjs/observable/never' {
  declare module.exports: {
    never<U>(): rxjs$Observable<U>;
  }
}
declare module 'rxjs/observable/of' {
  declare module.exports: {
    of<+T>(...values: T[]): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/onErrorResumeNext' {
  declare module.exports: {
    // TODO
  }
}
declare module 'rxjs/observable/pairs' {
  declare module.exports: {
    // TODO
  }
}
declare module 'rxjs/observable/race' {
  declare module.exports: {
    // TODO
  }
}
declare module 'rxjs/observable/range' {
  declare module.exports: {
    range(
      start?: number,
      count?: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<number>;
  }
}
declare module 'rxjs/observable/throwError' {
  declare module.exports: {
    throwError(error: any): rxjs$Observable<any>;
  }
}
declare module 'rxjs/observable/timer' {
  declare module.exports: {
    timer(
      initialDelay: number | Date,
      period?: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<number>;
  }
}
declare module 'rxjs/observable/using' {
  declare module.exports: {
    using<+T, R: rxjs$ISubscription>(
      resourceFactory: () => ?R,
      observableFactory: (resource: R) => rxjs$Observable<T> | Promise<T> | void
    ): rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/zip' {
  declare module.exports: {
    zip<A, B>(
      a: rxjs$Observable<A>,
      resultSelector: (a: A) => B
    ): rxjs$Observable<B>;

    zip<A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      resultSelector: (a: A, b: B) => C
    ): rxjs$Observable<C>;

    zip<A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      resultSelector: (a: A, b: B, c: C) => D
    ): rxjs$Observable<D>;

    zip<A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      resultSelector: (a: A, b: B, c: C, d: D) => E
    ): rxjs$Observable<E>;

    zip<A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E) => F
    ): rxjs$Observable<F>;

    zip<A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E, f: F) => G
    ): rxjs$Observable<G>;

    zip<A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      resultSelector: (a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H
    ): rxjs$Observable<H>;

    zip<A>(a: rxjs$Observable<A>, _: void): rxjs$Observable<[A]>;

    zip<A, B>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      _: void
    ): rxjs$Observable<[A, B]>;

    zip<A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      _: void
    ): rxjs$Observable<[A, B, C]>;

    zip<A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      _: void
    ): rxjs$Observable<[A, B, C, D]>;

    zip<A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E]>;

    zip<A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E, F]>;

    zip<A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E, F, G]>;

    zip<A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      h: rxjs$Observable<H>,
      _: void
    ): rxjs$Observable<[A, B, C, D, E, F, G, H]>;
  }
}

declare class rxjs$ConnectableObservable<T> extends rxjs$Observable<T> {
  connect(): rxjs$Subscription;
  refCount(): rxjs$Observable<T>;
}

declare module "rxjs/operators" {
  declare module.exports: {
    audit<+T>(
      durationSelector: (value: T) => rxjs$Observable<any> | Promise<any>
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    auditTime<+T>(
      duration: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    race<+T>(other: rxjs$Observable<T>): rxjs$Observable<T> => rxjs$Observable<T>;

    repeat<+T>(count?: number): rxjs$Observable<T> => rxjs$Observable<T>;

    buffer<+T>(bufferBoundaries: rxjs$Observable<any>): rxjs$Observable<T> => rxjs$Observable<Array<T>>;

    bufferCount<+T>(
      bufferSize: number,
      startBufferEvery?: number
    ): rxjs$Observable<T> => rxjs$Observable<Array<T>>;

    bufferTime<+T>(
      bufferTimeSpan: number,
      bufferCreationInterval?: number,
      maxBufferSize?: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$Observable<Array<T>>;

    bufferToggle<+T, U>(
      openings: rxjs$Observable<U> | Promise<U>,
      closingSelector: (value: U) => rxjs$Observable<any> | Promise<any>
    ): rxjs$Observable<T> => rxjs$Observable<Array<T>>;

    bufferWhen<+T>(
      closingSelector: () => rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<Array<T>>;

    catchError<+T, U>(
      selector: (err: any, caught: rxjs$Observable<T>) => rxjs$Observable<U>
    ): rxjs$Observable<T> => rxjs$Observable<U>;

    concat<+T, U>(...sources: rxjs$Observable<U>[]): rxjs$Observable<T> => rxjs$Observable<T | U>;

    concatAll<+T, U>(): rxjs$Observable<T> => rxjs$Observable<U>;

    concatMap<+T, U>(
      f: (value: T, index: number) => rxjs$ObservableInput<U>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    concatMap<+T, U, V>(
      f: (value: T, index: number) => rxjs$ObservableInput<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V
    ): rxjs$Observable<T> => rxjs$Observable<V>;

    debounceTime<+T>(
      dueTime: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    defaultIfEmpty<+T, U>(defaultValue: U): rxjs$Observable<T> => rxjs$Observable<T | U>;

    delay<+T>(dueTime: number, scheduler?: rxjs$SchedulerClass): rxjs$Observable<T> => rxjs$Observable<T>;

    delayWhen<+T>(
      delayDurationSelector: (value: T) => rxjs$Observable<any>,
      subscriptionDelay?: rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    distinctUntilChanged<+T>(compare?: (x: T, y: T) => boolean): rxjs$Observable<T> => rxjs$Observable<T>;

    distinct<+T, U>(
      keySelector?: (value: T) => U,
      flushes?: rxjs$Observable<mixed>
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    distinctUntilKeyChanged<+T>(
      key: string,
      compare?: (x: mixed, y: mixed) => boolean
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    elementAt<+T>(index: number, defaultValue?: T): rxjs$Observable<T> => rxjs$Observable<T>;

    exhaustMap<+T, U>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    exhaustMap<+T, U, V>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V
    ): rxjs$Observable<T> => rxjs$Observable<V>;

    expand<+T>(
      project: (value: T, index: number) => rxjs$Observable<T>,
      concurrent?: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    filter<+T>(
      predicate: (value: T, index: number) => boolean,
      thisArg?: any
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    finalize<+T>(f: () => mixed): rxjs$Observable<T> => rxjs$Observable<T>;

    first<+T, U>(
      predicate: ?(
        value: T,
        index: number,
        source: rxjs$Observable<T>
      ) => boolean,
      resultSelector: (value: T, index: number) => U
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    first<+T, U>(
      predicate: ?(
        value: T,
        index: number,
        source: rxjs$Observable<T>
      ) => boolean,
      resultSelector: ?(value: T, index: number) => U,
      defaultValue: U
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    first<+T>(
      predicate?: (value: T, index: number, source: rxjs$Observable<T>) => boolean
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    groupBy<+T, K>(
      keySelector: (value: T) => K,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<rxjs$GroupedObservable<K, T>>;
    groupBy<+T, K, V>(
      keySelector: (value: T) => K,
      elementSelector: (value: T) => V,
      durationSelector?: (
        grouped: rxjs$GroupedObservable<K, V>
      ) => rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<rxjs$GroupedObservable<K, V>>;

    ignoreElements<+T, U>(): rxjs$Observable<T> => rxjs$Observable<U>;

    last<+T>(
      predicate?: (value: T, index: number, source: rxjs$Observable<T>) => boolean
    ): rxjs$Observable<T> => rxjs$Observable<T>;
    last<+T, U>(
      predicate: ?(
        value: T,
        index: number,
        source: rxjs$Observable<T>
      ) => boolean,
      resultSelector: (value: T, index: number) => U
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    last<+T, U>(
      predicate: ?(
        value: T,
        index: number,
        source: rxjs$Observable<T>
      ) => boolean,
      resultSelector: ?(value: T, index: number) => U,
      defaultValue: U
    ): rxjs$Observable<T> => rxjs$Observable<U>;

    startWith<+T>(...values: Array<T>): rxjs$Observable<T> => rxjs$Observable<T>;

    // Alias for `mergeMap`
    flatMap<+T, U>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      concurrency?: number
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    flatMap<+T, U, V>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V,
      concurrency?: number
    ): rxjs$Observable<T> => rxjs$Observable<V>;

    flatMapTo<+T, U>(innerObservable: rxjs$Observable<U>): rxjs$Observable<T> => rxjs$Observable<U>;

    flatMapTo<+T, U, V>(
      innerObservable: rxjs$Observable<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V,
      concurrent?: number
    ): rxjs$Observable<T> => rxjs$Observable<V>;

    switchMap<+T, U, V>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V
    ): rxjs$Observable<T> => rxjs$Observable<V>;
    switchMap<+T, U>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>
    ): rxjs$Observable<T> => rxjs$Observable<U>;

    switchMapTo<+T, U>(innerObservable: rxjs$Observable<U>): rxjs$Observable<T> => rxjs$Observable<U>;

    map<+T, U>(f: (value: T, index: number) => U, thisArg?: any): rxjs$Observable<T> => rxjs$Observable<U>;

    mapTo<+T, U>(value: U): rxjs$Observable<T> => rxjs$Observable<U>;

    merge<+T>(other: rxjs$Observable<T>): rxjs$Observable<T> => rxjs$Observable<T>;

    mergeAll<+T, U>(): rxjs$Observable<T> => rxjs$Observable<U>;

    mergeMap<+T, U>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      concurrency?: number
    ): rxjs$Observable<T> => rxjs$Observable<U>;
    mergeMap<+T, U, V>(
      project: (value: T, index: number) => rxjs$ObservableInput<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V,
      concurrency?: number
    ): rxjs$Observable<T> => rxjs$Observable<V>;

    mergeMapTo<+T, U>(innerObservable: rxjs$Observable<U>): rxjs$Observable<T> => rxjs$Observable<U>;

    mergeMapTo<+T, U, V>(
      innerObservable: rxjs$Observable<U>,
      resultSelector: (
        outerValue: T,
        innerValue: U,
        outerIndex: number,
        innerIndex: number
      ) => V,
      concurrent?: number
    ): rxjs$Observable<T> => rxjs$Observable<V>;

    multicast<+T>(
      subjectOrSubjectFactory: rxjs$Subject<T> | (() => rxjs$Subject<T>)
    ): rxjs$Observable<T> => rxjs$ConnectableObservable<T>;

    pairwise<+T>(): rxjs$Observable<T> => rxjs$Observable<[T, T]>;

    partition<+T>(
      predicate: (value: T, index: number) => boolean,
      thisArg: any
    ): rxjs$Observable<T> => [rxjs$Observable<T>, rxjs$Observable<T>];

    publish<+T>(): rxjs$Observable<T> => rxjs$ConnectableObservable<T>;

    publishLast<+T>(): rxjs$Observable<T> => rxjs$ConnectableObservable<T>;

    reduce<+T, U>(
      accumulator: (
        acc: U,
        currentValue: T,
        index: number,
        source: rxjs$Observable<T>
      ) => U,
      seed: U
    ): rxjs$Observable<T> => rxjs$Observable<U>;

    sample<+T>(notifier: rxjs$Observable<any>): rxjs$Observable<T> => rxjs$Observable<T>;

    sampleTime<+T>(
      delay: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    publishReplay<+T>(
      bufferSize?: number,
      windowTime?: number,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$ConnectableObservable<T>;

    retry<+T>(retryCount: ?number): rxjs$Observable<T> => rxjs$Observable<T>;

    retryWhen<+T>(
      notifier: (errors: rxjs$Observable<Error>) => rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    scan<+T, U>(f: (acc: U, value: T) => U, initialValue: U): rxjs$Observable<T> => rxjs$Observable<U>;

    share<+T>(): rxjs$Observable<T> => rxjs$Observable<T>;

    skip<+T>(count: number): rxjs$Observable<T> => rxjs$Observable<T>;

    skipUntil<+T>(other: rxjs$Observable<any> | Promise<any>): rxjs$Observable<T> => rxjs$Observable<T>;

    skipWhile<+T>(
      predicate: (value: T, index: number) => boolean
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    startWith<+T>(...values: Array<T>): rxjs$Observable<T> => rxjs$Observable<T>;

    subscribeOn<+T>(scheduler: rxjs$SchedulerClass): rxjs$Observable<T> => rxjs$Observable<T>;

    take<+T>(count: number): rxjs$Observable<T> => rxjs$Observable<T>;

    takeUntil<+T>(other: rxjs$Observable<any>): rxjs$Observable<T> => rxjs$Observable<T>;

    takeWhile<+T>(
      predicate: (value: T, index: number) => boolean
    ): rxjs$Observable<T> => rxjs$Observable<T>;

    tap: (<+T>(
      onNext?: (value: T) => mixed,
      onError?: (error: any) => mixed,
      onCompleted?: () => mixed
    ) => rxjs$Observable<T> => rxjs$Observable<T>) &
    (<+T>(observer: {
      next?: (value: T) => mixed,
      error?: (error: any) => mixed,
      complete?: () => mixed
    }) => rxjs$Observable<T> => rxjs$Observable<T>);

    throttleTime<+T>(duration: number): rxjs$Observable<T> => rxjs$Observable<T>;

    timeout<+T>(due: number | Date, _: void): rxjs$Observable<T> => rxjs$Observable<T>;

    timeoutWith<+T, U>(
      due: number | Date,
      withObservable: rxjs$Observable<U>,
      scheduler?: rxjs$SchedulerClass
    ): rxjs$Observable<T> => rxjs$Observable<T | U>;

    combineLatest<+T, A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H
    ): rxjs$Observable<T> => rxjs$Observable<H>;

    combineLatest<+T, A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E, f: F) => G
    ): rxjs$Observable<T> => rxjs$Observable<G>;

    combineLatest<+T, A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E) => F
    ): rxjs$Observable<T> => rxjs$Observable<F>;

    combineLatest<+T, A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D) => E
    ): rxjs$Observable<T> => rxjs$Observable<E>;

    combineLatest<+T, A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      resultSelector: (t: T, a: A, b: B, c: C) => D
    ): rxjs$Observable<T> => rxjs$Observable<D>;

    combineLatest<+T, A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      resultSelector: (t: T, a: A, b: B) => C
    ): rxjs$Observable<T> => rxjs$Observable<C>;

    combineLatest<+T, A, B>(
      a: rxjs$Observable<A>,
      resultSelector: (t: T, a: A) => B
    ): rxjs$Observable<T> => rxjs$Observable<B>;

    combineLatest<+T, A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E, E, F, G]>;

    combineLatest<+T, A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E, F]>;

    combineLatest<+T, A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E]>;

    combineLatest<+T, A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D]>;

    combineLatest<+T, A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C]>;

    combineLatest<+T, A, B>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B]>;

    combineLatest<+T, A>(a: rxjs$Observable<A>, _: void): rxjs$Observable<T> => rxjs$Observable<[T, A]>;

    zip<+T, A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H
    ): rxjs$Observable<T> => rxjs$Observable<H>;

    zip<+T, A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E, f: F) => G
    ): rxjs$Observable<T> => rxjs$Observable<G>;

    zip<+T, A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E) => F
    ): rxjs$Observable<T> => rxjs$Observable<F>;

    zip<+T, A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D) => E
    ): rxjs$Observable<T> => rxjs$Observable<E>;

    zip<+T, A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      resultSelector: (t: T, a: A, b: B, c: C) => D
    ): rxjs$Observable<T> => rxjs$Observable<D>;

    zip<+T, A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      resultSelector: (t: T, a: A, b: B) => C
    ): rxjs$Observable<T> => rxjs$Observable<C>;

    zip<+T, A, B>(
      a: rxjs$Observable<A>,
      resultSelector: (t: T, a: A) => B
    ): rxjs$Observable<T> => rxjs$Observable<B>;

    zip<+T, A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E, E, F, G]>;

    zip<+T, A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E, F]>;

    zip<+T, A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E]>;

    zip<+T, A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D]>;

    zip<+T, A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C]>;

    zip<+T, A, B>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B]>;

    zip<+T, A>(a: rxjs$Observable<A>, _: void): rxjs$Observable<T> => rxjs$Observable<[T, A]>;

    window<+T>(
      windowBoundaries: rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<rxjs$Observable<T>>;
    windowCount<+T>(
      windowSize: number,
      startWindowEvery?: number
    ): rxjs$Observable<T> => rxjs$Observable<rxjs$Observable<T>>;
    windowToggle<+T, A>(
      openings: rxjs$Observable<A>,
      closingSelector: (value: A) => rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<rxjs$Observable<T>>;
    windowWhen<+T>(
      closingSelector: () => rxjs$Observable<any>
    ): rxjs$Observable<T> => rxjs$Observable<rxjs$Observable<T>>;

    withLatestFrom<+T, A, B, C, D, E, F, G, H>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H
    ): rxjs$Observable<T> => rxjs$Observable<H>;

    withLatestFrom<+T, A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E, f: F) => G
    ): rxjs$Observable<T> => rxjs$Observable<G>;

    withLatestFrom<+T, A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D, e: E) => F
    ): rxjs$Observable<T> => rxjs$Observable<F>;

    withLatestFrom<+T, A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      resultSelector: (t: T, a: A, b: B, c: C, d: D) => E
    ): rxjs$Observable<T> => rxjs$Observable<E>;

    withLatestFrom<+T, A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      resultSelector: (t: T, a: A, b: B, c: C) => D
    ): rxjs$Observable<T> => rxjs$Observable<D>;

    withLatestFrom<+T, A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      resultSelector: (t: T, a: A, b: B) => C
    ): rxjs$Observable<T> => rxjs$Observable<C>;

    withLatestFrom<+T, A, B>(
      a: rxjs$Observable<A>,
      resultSelector: (t: T, a: A) => B
    ): rxjs$Observable<T> => rxjs$Observable<B>;

    withLatestFrom<+T, A, B, C, D, E, F, G>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      g: rxjs$Observable<G>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E, E, F, G]>;

    withLatestFrom<+T, A, B, C, D, E, F>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      f: rxjs$Observable<F>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E, F]>;

    withLatestFrom<+T, A, B, C, D, E>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      e: rxjs$Observable<E>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D, E]>;

    withLatestFrom<+T, A, B, C, D>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      d: rxjs$Observable<D>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C, D]>;

    withLatestFrom<+T, A, B, C>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      c: rxjs$Observable<C>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B, C]>;

    withLatestFrom<+T, A, B>(
      a: rxjs$Observable<A>,
      b: rxjs$Observable<B>,
      _: void
    ): rxjs$Observable<T> => rxjs$Observable<[T, A, B]>;

    withLatestFrom<+T, A>(a: rxjs$Observable<A>, _: void): rxjs$Observable<T> => rxjs$Observable<[T, A]>;

    refCount<T>(): rxjs$ConnectableObservable<T> => rxjs$Observable<T>;
  };
}

declare class rxjs$GroupedObservable<K, V> extends rxjs$Observable<V> {
  key: K;
}

declare class rxjs$Observer<-T> {
  next(value: T): mixed;
  error(error: any): mixed;
  complete(): mixed;
}

declare interface rxjs$Operator<T, R> {
  call(subscriber: rxjs$Subscriber<R>, source: any): rxjs$TeardownLogic;
}

declare class rxjs$Subject<T> mixins rxjs$Observable<T>, rxjs$Observer<T> {
  static create<T>(
    destination: rxjs$Observer<T>,
    source: rxjs$Observable<T>
  ): rxjs$AnonymousSubject<T>;

  asObservable(): rxjs$Observable<T>;
  observers: Array<rxjs$Observer<T>>;
  unsubscribe(): void;

  // For use in subclasses only:
  _next(value: T): void;
}

declare class rxjs$AnonymousSubject<T> extends rxjs$Subject<T> {
  source: ?rxjs$Observable<T>;
  destination: ?rxjs$Observer<T>;

  constructor(
    destination?: rxjs$Observer<T>,
    source?: rxjs$Observable<T>
  ): void;
}

declare class rxjs$BehaviorSubject<T> extends rxjs$Subject<T> {
  constructor(initialValue: T): void;

  getValue(): T;
}

declare class rxjs$ReplaySubject<T> extends rxjs$Subject<T> {
  constructor(
    bufferSize?: number,
    windowTime?: number,
    scheduler?: rxjs$SchedulerClass
  ): void;
}

declare class rxjs$Subscription {
  unsubscribe(): void;
  add(teardown: rxjs$TeardownLogic): rxjs$Subscription;
}

declare class rxjs$Subscriber<T> extends rxjs$Subscription {
  static create<T>(
    next?: (x?: T) => void,
    error?: (e?: any) => void,
    complete?: () => void
  ): rxjs$Subscriber<T>;

  constructor(
    destinationOrNext?: rxjs$PartialObserver<any> | ((value: T) => void),
    error?: (e?: any) => void,
    complete?: () => void
  ): void;
  next(value?: T): void;
  error(err?: any): void;
  complete(): void;
  unsubscribe(): void;
}

declare class rxjs$SchedulerClass {
  schedule<T>(
    work: (state?: T) => void,
    delay?: number,
    state?: T
  ): rxjs$Subscription;
}

declare class rxjs$ArgumentOutOfRangeError extends Error {}
declare class rxjs$EmptyError extends Error {}
declare class rxjs$ObjectUnsubscribedError extends Error {}
declare class rxjs$TimeoutError extends Error {}
declare class rxjs$UnsubscriptionError extends Error {}

declare module "rxjs" {
  declare module.exports: {
    Observable: typeof rxjs$Observable,
    Observer: typeof rxjs$Observer,
    ConnectableObservable: typeof rxjs$ConnectableObservable,
    Subject: typeof rxjs$Subject,
    Subscriber: typeof rxjs$Subscriber,
    AnonymousSubject: typeof rxjs$AnonymousSubject,
    BehaviorSubject: typeof rxjs$BehaviorSubject,
    ReplaySubject: typeof rxjs$ReplaySubject,
    Scheduler: {
      asap: rxjs$SchedulerClass,
      queue: rxjs$SchedulerClass,
      animationFrame: rxjs$SchedulerClass,
      async: rxjs$SchedulerClass
    },
    Subscription: typeof rxjs$Subscription,
    ArgumentOutOfRangeError: typeof rxjs$ArgumentOutOfRangeError,
    EmptyError: typeof rxjs$EmptyError,
    ObjectUnsubscribedError: typeof rxjs$ObjectUnsubscribedError,
    TimeoutError: typeof rxjs$TimeoutError,
    UnsubscriptionError: typeof rxjs$UnsubscriptionError,
  };
}

declare module "rxjs/Observable" {
  declare module.exports: {
    Observable: typeof rxjs$Observable
  };
}

declare module "rxjs/Observer" {
  declare module.exports: {
    Observer: typeof rxjs$Observer
  };
}

declare module "rxjs/BehaviorSubject" {
  declare module.exports: {
    BehaviorSubject: typeof rxjs$BehaviorSubject
  };
}

declare module "rxjs/ReplaySubject" {
  declare module.exports: {
    ReplaySubject: typeof rxjs$ReplaySubject
  };
}

declare module "rxjs/Subject" {
  declare module.exports: {
    Subject: typeof rxjs$Subject,
    AnonymousSubject: typeof rxjs$AnonymousSubject
  };
}

declare module "rxjs/Subscriber" {
  declare module.exports: {
    Subscriber: typeof rxjs$Subscriber
  };
}

declare module "rxjs/Subscription" {
  declare module.exports: {
    Subscription: typeof rxjs$Subscription
  };
}

declare module "rxjs/testing/TestScheduler" {
  declare module.exports: {
    TestScheduler: typeof rxjs$SchedulerClass
  };
}

declare module "rxjs/util/ArgumentOutOfRangeError" {
  declare module.exports: {
    ArgumentOutOfRangeError: typeof rxjs$ArgumentOutOfRangeError,
  };
}

declare module "rxjs/util/EmptyError" {
  declare module.exports: {
    EmptyError: typeof rxjs$EmptyError,
  };
}

declare module "rxjs/util/ObjectUnsubscribedError" {
  declare module.exports: {
    ObjectUnsubscribedError: typeof rxjs$ObjectUnsubscribedError,
  };
}

declare module "rxjs/util/TimeoutError" {
  declare module.exports: {
    TimeoutError: typeof rxjs$TimeoutError,
  };
}

declare module "rxjs/util/UnsubscriptionError" {
  declare module.exports: {
    UnsubscriptionError: typeof rxjs$UnsubscriptionError,
  };
}
