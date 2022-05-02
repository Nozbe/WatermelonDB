// @flow

export default function groupBy<Val, Key>(
  predicate: (Val) => Key,
): (list: Val[]) => { [k:string]: Val[] };
