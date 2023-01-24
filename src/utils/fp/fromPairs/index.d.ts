// inspired by ramda and rambda

type KeyValueIn<O = any> = { [k: string]: O }
type KeyValueOut<O = any> = [string, O][]

export default function fromPairs<O = any>(pairs: KeyValueIn<O>): KeyValueOut<O>
