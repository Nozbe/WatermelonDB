export default function groupBy<Val, Key>(
  predicate: (_: Val) => Key,
): (list: Val[]) => { [k: string]: Val[] }
