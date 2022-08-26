const stringNull = ['', null]
const booleanNull = [false, null]
const numberNull = [0, null]

// value - input, value: [a, b] - expected outputs for a - required fields, b - optional fields
export const expectedSanitizations = [
  { value: 'Hello', string: ['Hello', 'Hello'], boolean: booleanNull, number: numberNull },
  { value: '', string: ['', ''], boolean: booleanNull, number: numberNull },
  { value: 'true', string: ['true', 'true'], boolean: booleanNull, number: numberNull },
  { value: 'false', string: ['false', 'false'], boolean: booleanNull, number: numberNull },
  { value: '1', string: ['1', '1'], boolean: booleanNull, number: numberNull },
  { value: '0', string: ['0', '0'], boolean: booleanNull, number: numberNull },
  { value: 'NaN', string: ['NaN', 'NaN'], boolean: booleanNull, number: numberNull },
  { value: 1, string: stringNull, boolean: [true, true], number: [1, 1] },
  { value: 0, string: stringNull, boolean: [false, false], number: [0, 0] },
  { value: +0.0, string: stringNull, boolean: [false, false], number: [0, 0] },
  { value: -0.0, string: stringNull, boolean: [false, false], number: [0, 0] },
  { value: 3.14, string: stringNull, boolean: booleanNull, number: [3.14, 3.14] },
  { value: -3.14, string: stringNull, boolean: booleanNull, number: [-3.14, -3.14] },
  {
    value: 1532612920392,
    string: stringNull,
    boolean: booleanNull,
    number: [1532612920392, 1532612920392],
  },
  { value: true, string: stringNull, boolean: [true, true], number: numberNull },
  { value: false, string: stringNull, boolean: [false, false], number: numberNull },
  { value: NaN, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: Infinity, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: -Infinity, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: null, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: undefined, string: stringNull, boolean: booleanNull, number: numberNull },
  { value: {}, string: stringNull, boolean: booleanNull, number: numberNull },
  {
    value: { __proto__: { value: 'Hello' } },
    string: stringNull,
    boolean: booleanNull,
    number: numberNull,
  },
  {
    value: { __proto__: { valueOf: () => 10 } },
    string: stringNull,
    boolean: booleanNull,
    number: numberNull,
  },
  { value: [], string: stringNull, boolean: booleanNull, number: numberNull },
]
