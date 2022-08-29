// inspired by ramda and rambda
/* eslint-disable */

type KeyValueOut<O = any> = {[k: string]: O};
type KeyValueIn<O = any> = [k:string, o: O][];

export default function toPairs(obj: KeyValueIn): KeyValueOut;
