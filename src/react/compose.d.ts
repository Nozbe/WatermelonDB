declare function compose<A>(): (A) => A
declare function compose<A, B>(fn: (A) => B): (A) => B
declare function compose<A, B, C>(fn0: (B) => C, fn1: (A) => B): (A) => C
declare function compose<A, B, C, D>(fn0: (C) => D, fn1: (B) => C, fn2: (A) => B): (A) => D
declare function compose<A, B, C, D, E>(
  fn0: (D) => E,
  fn1: (C) => D,
  fn2: (B) => C,
  fn3: (A) => B,
): (A) => E
declare function compose<A, B, C, D, E, F>(
  fn0: (E) => F,
  fn1: (D) => E,
  fn2: (C) => D,
  fn3: (B) => C,
  fn4: (A) => B,
): (A) => F
declare function compose<A, B, C, D, E, F, G>(
  fn0: (F) => G,
  fn1: (E) => F,
  fn2: (D) => E,
  fn3: (C) => D,
  fn4: (B) => C,
  fn5: (A) => B,
): (A) => G
declare function compose<A, B, C, D, E, F, G, H>(
  fn0: (G) => H,
  fn1: (F) => G,
  fn2: (E) => F,
  fn3: (D) => E,
  fn4: (C) => D,
  fn5: (B) => C,
  fn6: (A) => B,
): (A) => H
declare function compose<A, B, C, D, E, F, G, H, I>(
  fn0: (H) => I,
  fn1: (G) => H,
  fn2: (F) => G,
  fn3: (E) => F,
  fn4: (D) => E,
  fn5: (C) => D,
  fn6: (B) => C,
  fn7: (A) => B,
): (A) => I
declare function compose<A, B, C, D, E, F, G, H, I, J>(
  fn0: (I) => J,
  fn1: (H) => I,
  fn2: (G) => H,
  fn3: (F) => G,
  fn4: (E) => F,
  fn5: (D) => E,
  fn6: (C) => D,
  fn7: (B) => C,
  fn8: (A) => B,
): (A) => I

export default compose
