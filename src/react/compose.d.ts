declare function compose<A>(): (arg0: A) => A
declare function compose<A, B>(fn: (arg0: A) => B): (arg0: A) => B
declare function compose<A, B, C>(fn0: (arg0: B) => C, fn1: (arg0: A) => B): (arg0: A) => C
declare function compose<A, B, C, D>(
  fn0: (arg0: C) => D,
  fn1: (arg0: B) => C,
  fn2: (arg0: A) => B,
): (arg0: A) => D
declare function compose<A, B, C, D, E>(
  fn0: (arg0: D) => E,
  fn1: (arg0: C) => D,
  fn2: (arg0: B) => C,
  fn3: (arg0: A) => B,
): (arg0: A) => E
declare function compose<A, B, C, D, E, F>(
  fn0: (arg0: E) => F,
  fn1: (arg0: D) => E,
  fn2: (arg0: C) => D,
  fn3: (arg0: B) => C,
  fn4: (arg0: A) => B,
): (arg0: A) => F
declare function compose<A, B, C, D, E, F, G>(
  fn0: (arg0: F) => G,
  fn1: (arg0: E) => F,
  fn2: (arg0: D) => E,
  fn3: (arg0: C) => D,
  fn4: (arg0: B) => C,
  fn5: (arg0: A) => B,
): (arg0: A) => G
declare function compose<A, B, C, D, E, F, G, H>(
  fn0: (arg0: G) => H,
  fn1: (arg0: F) => G,
  fn2: (arg0: E) => F,
  fn3: (arg0: D) => E,
  fn4: (arg0: C) => D,
  fn5: (arg0: B) => C,
  fn6: (arg0: A) => B,
): (arg0: A) => H
declare function compose<A, B, C, D, E, F, G, H, I>(
  fn0: (arg0: H) => I,
  fn1: (arg0: G) => H,
  fn2: (arg0: F) => G,
  fn3: (arg0: E) => F,
  fn4: (arg0: D) => E,
  fn5: (arg0: C) => D,
  fn6: (arg0: B) => C,
  fn7: (arg0: A) => B,
): (arg0: A) => I
declare function compose<A, B, C, D, E, F, G, H, I, J>(
  fn0: (arg0: I) => J,
  fn1: (arg0: H) => I,
  fn2: (arg0: G) => H,
  fn3: (arg0: F) => G,
  fn4: (arg0: E) => F,
  fn5: (arg0: D) => E,
  fn6: (arg0: C) => D,
  fn7: (arg0: B) => C,
  fn8: (arg0: A) => B,
): (arg0: A) => I

export default compose
