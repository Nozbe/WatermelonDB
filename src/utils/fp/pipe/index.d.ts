type Pipe = (<A, B, C, D, E, F, G>(
  ab: (_: A) => B,
  bc: (_: B) => C,
  cd: (_: C) => D,
  de: (_: D) => E,
  ef: (_: E) => F,
  fg: (_: F) => G,
) => (_: A) => G) &
  (<A, B, C, D, E, F>(
    ab: (_: A) => B,
    bc: (_: B) => C,
    cd: (_: C) => D,
    de: (_: D) => E,
    ef: (_: E) => F,
  ) => (_: A) => F) &
  (<A, B, C, D, E>(ab: (_: A) => B, bc: (_: B) => C, cd: (_: C) => D, de: (_: D) => E) => (_: A) => E) &
  (<A, B, C, D>(ab: (_: A) => B, bc: (_: B) => C, cd: (_: C) => D) => (_: A) => D) &
  (<A, B, C>(ab: (_: A) => B, bc: (_: B) => C) => (_: A) => C) &
  (<A, B>(ab: (_: A) => B) => (_: A) => B)

declare function pipe(...fns: ((_: any) => any)[]): Pipe

export default pipe
