// inspired by ramda and rambda


type KeyValueOut<O = any> = { [k: string]: O }
type KeyValueIn<O = any> = [string, O][]

export default function toPairs(obj: KeyValueIn): KeyValueOut
