// inspired by ramda and rambda
/* eslint-disable */

type KeyValueIn<O = any> = { [k: string]: O }
type KeyValueOut<O = any> = [k: string, o: O][]

export default function fromPairs<O = any>(pairs: KeyValueIn<O>): KeyValueOut<O>
