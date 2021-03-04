// @flow

type Pipe = (<A, B, C, D, E, F, G>(
  ab: (A => B),
  bc: (B => C),
  cd: (C => D),
  de: (D => E),
  ef: (E => F),
  fg: (F => G),
) => (A => G)) &
  (<A, B, C, D, E, F>(
    ab: (A => B),
    bc: (B => C),
    cd: (C => D),
    de: (D => E),
    ef: (E => F),
  ) => (A => F)) &
  (<A, B, C, D, E>(
    ab: (A => B),
    bc: (B => C),
    cd: (C => D),
    de: (D => E),
  ) => (A => E)) &
  (<A, B, C, D>(ab: (A => B), bc: (B => C), cd: (C => D)) => (A => D)) &
  (<A, B, C>(ab: (A => B), bc: (B => C)) => (A => C)) &
  (<A, B>(ab: (A => B)) => (A => B))

function pipe(...fns: (any => any)[]): (any => any) {
  const fnsLen = fns.length
  return (...args) => {
    let result = undefined

    if (fnsLen) {
      result = fns[0](...args)
      for (let i = 1; i < fnsLen; i ++) {
        result = fns[i](result)
      }
    }

    return result
  }
}

export default (pipe: Pipe)
