import naughtyStrings from 'big-list-of-naughty-strings'
import * as Q from '../QueryDescription'

export const matchTests = [
  {
    name: 'matches everything',
    query: [],
    matching: [{ id: 'm1' }, { id: 'm2', num1: 10 }],
    nonMatching: [],
  },
  {
    name: 'matches strings',
    query: [Q.where('text1', 'value1')],
    matching: [{ id: 'm1', text1: 'value1' }],
    nonMatching: [{ id: 'n1' }, { id: 'n2', text1: null }, { id: 'n3', text1: 'other_value' }],
  },
  {
    name: 'matches `true`',
    query: [Q.where('bool1', true)],
    matching: [{ id: 'm1', bool1: true }, { id: 'm2', bool1: 1 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', bool1: null },
      { id: 'n3', bool1: false },
      { id: 'n4', bool1: 0 },
    ],
  },
  {
    name: 'matches `false`',
    query: [Q.where('bool2', false)],
    matching: [{ id: 'm1', bool2: false }, { id: 'm2', bool2: 0 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', bool2: null },
      { id: 'n3', bool2: true },
      { id: 'n4', bool2: 1 },
    ],
  },
  {
    name: 'matches `null`',
    query: [Q.where('num1', null)],
    matching: [{ id: 'm1' }, { id: 'm2', num1: null }, { id: 'm3', num1: undefined }],
    nonMatching: [{ id: 'n1', num1: 0 }, { id: 'n2', num1: false }, { id: 'n3', num1: '' }],
  },
  {
    name: 'matches integers (0)',
    query: [Q.where('num1', 0)],
    matching: [{ id: 'm1', num1: 0 }, { id: 'm2', num1: false }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num1: 1 },
      { id: 'n4', num1: true },
    ],
  },
  {
    name: 'matches integers (1)',
    query: [Q.where('num1', 1)],
    matching: [{ id: 'm1', num1: 1 }, { id: 'm2', num1: true }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num1: 0 },
      { id: 'n4', num1: false },
    ],
  },
  {
    name: 'matches floats',
    query: [Q.where('float1', 3.14)],
    matching: [{ id: 'm1', float1: 3.14 }],
    nonMatching: [{ id: 'n1', float1: null }, { id: 'n2', float1: 1.0 }],
  },
  {
    name: 'matches big numbers (e.g. JS timestamps)',
    query: [Q.where('float1', 1590485104033)],
    matching: [{ id: 'm1', float1: 1590485104033 }],
    nonMatching: [{ id: 'n1', float1: null }, { id: 'n2', float1: 159048510 }],
  },
  {
    name: 'matches multiple conditions',
    query: [
      Q.where('text1', `value1`),
      Q.where('num1', 2),
      Q.where('bool1', true),
      Q.where('bool2', false),
      Q.where('float1', null),
    ],
    matching: [
      { id: 'm1', text1: 'value1', num1: 2, bool1: true, bool2: false, float1: null },
      { id: 'm2', text1: 'value1', num1: 2, bool1: 1, bool2: 0 },
    ],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', text1: 'value2', num1: 2, bool1: true, bool2: false, float1: null },
      { id: 'n3', text1: 'value1', num1: 2, bool1: true, bool2: true, float1: null },
    ],
  },
  {
    name: 'matches by greater-than',
    query: [Q.where('num1', Q.gt(2))],
    matching: [{ id: 'm1', num1: 3 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num1: undefined },
      { id: 'n4', num1: 0 },
      { id: 'n5', num1: 2 },
    ],
  },
  {
    name: 'matches by greater-than-or-equal',
    query: [Q.where('float1', Q.gte(2.1))],
    matching: [{ id: 'm1', float1: 2.1 }, { id: 'm2', float1: 5 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', float1: null },
      { id: 'n3', float1: undefined },
      { id: 'n4', float1: 0 },
      { id: 'n5', float1: 2 },
      { id: 'n6', float1: 2.09 },
    ],
  },
  {
    name: 'matches by greater-than with JS-like semantics',
    query: [Q.where('num1', Q.weakGt(2))],
    matching: [{ id: 'm1', num1: 3 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num1: undefined },
      { id: 'n4', num1: 0 },
      { id: 'n5', num1: 2 },
    ],
  },
  {
    name: 'matches by less-than',
    query: [Q.where('float1', Q.lt(2))],
    matching: [{ id: 'm1', float1: 1 }, { id: 'm2', float1: 0 }],
    nonMatching: [{ id: 'n1', float1: 2 }, { id: 'n2', float1: null }, { id: 'n3' }],
  },
  {
    name: 'matches by less-than-or-equal',
    query: [Q.where('float1', Q.lte(2))],
    matching: [{ id: 'm1', float1: 2 }, { id: 'm2', float1: 0 }],
    nonMatching: [{ id: 'n1', float1: 2.1 }, { id: 'n2', float1: null }, { id: 'n3' }],
  },
  {
    name: 'matches by not-equal',
    query: [Q.where('text1', Q.notEq('foo'))],
    matching: [
      { id: 'm1' },
      { id: 'm2', text1: undefined },
      { id: 'm3', text1: null },
      { id: 'm4', text1: 'blah' },
      { id: 'm5', text1: 'Foo' },
      { id: 'm6', text1: 'FOO' },
    ],
    nonMatching: [{ id: 'n1', text1: 'foo' }],
  },
  {
    name: 'matches not-equal(null)',
    query: [Q.where('num1', Q.notEq(null))],
    matching: [
      { id: 'm1', num1: 1 },
      { id: 'm2', num1: 0 },
      { id: 'm3', num1: false },
      { id: 'm4', num1: '' },
    ],
    nonMatching: [{ id: 'n1', num1: null }, { id: 'n2', num1: undefined }, { id: 'n3' }],
  },
  {
    name: 'matches by IN',
    query: [Q.where('num1', Q.oneOf([0, 1, 2]))],
    matching: [{ id: 'm1', num1: 0 }, { id: 'm2', num1: 2 }],
    nonMatching: [{ id: 'n1' }, { id: 'n2', num1: null }, { id: 'n3', num1: 10 }],
  },
  {
    name: 'matches by NOT IN',
    query: [Q.where('num1', Q.notIn([0, 1, 2]))],
    matching: [{ id: 'm1', num1: 5 }, { id: 'm2', num1: 10 }],
    nonMatching: [
      { id: 'n1', num1: 0 },
      { id: 'n2', num1: 2 },
      { id: 'n3', num1: null },
      { id: 'n4', num1: undefined },
      { id: 'n5' },
    ],
  },
  {
    name: 'matches by BETWEEN',
    query: [Q.where('float1', Q.between(5, 10))],
    matching: [{ id: 'm1', float1: 5 }, { id: 'm2', float1: 10 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', float1: null },
      { id: 'n3', float1: 4 },
      { id: 'n4', float1: 11 },
    ],
  },
  {
    name: 'can compare columns (eq)',
    query: [Q.where('num1', Q.eq(Q.column('num2')))],
    matching: [
      { id: 'm1', num1: 'foo', num2: 'foo' },
      { id: 'm2', num1: 5, num2: 5 },
      { id: 'm4', num1: true, num2: true },
      { id: 'm5', num1: true, num2: 1 },
      { id: 'm6', num1: false, num2: false },
      { id: 'm7', num1: false, num2: 0 },
      { id: 'm8', num1: null },
      { id: 'm9', num2: null },
      { id: 'm0', num1: undefined, num2: null },
      { id: 'ma', num1: 3.14, num2: 3.14 },
      { id: 'mb' },
    ],
    nonMatching: [
      { id: 'n1', num1: 'foo', num2: 'bar' },
      { id: 'n2', num1: 5, num2: 6 },
      { id: 'n3', num1: 5.14, num2: 5.1399 },
      { id: 'n4', num1: true, num2: false },
      { id: 'n5', num1: null, num2: false },
      { id: 'n6', num1: undefined, num2: false },
      { id: 'n7', num2: false },
    ],
  },
  {
    name: 'can compare columns (notEq)',
    query: [Q.where('num1', Q.notEq(Q.column('num2')))],
    matching: [
      { id: 'n1', num1: 'foo', num2: 'bar' },
      { id: 'n2', num1: 5, num2: 6 },
      { id: 'n3', num1: 5.14, num2: 5.1399 },
      { id: 'n4', num1: true, num2: false },
      { id: 'n5', num1: null, num2: false },
      { id: 'n6', num1: undefined, num2: false },
      { id: 'n7', num2: false },
    ],
    nonMatching: [
      { id: 'm1', num1: 'foo', num2: 'foo' },
      { id: 'm2', num1: 5, num2: 5 },
      { id: 'm4', num1: true, num2: true },
      { id: 'm5', num1: true, num2: 1 },
      { id: 'm6', num1: false, num2: false },
      { id: 'm7', num1: false, num2: 0 },
      { id: 'm8', num1: null },
      { id: 'm9', num2: null },
      { id: 'm0', num1: undefined, num2: null },
      { id: 'ma', num1: 3.14, num2: 3.14 },
      { id: 'mb' },
    ],
  },
  {
    name: 'can compare columns (less-than)',
    query: [Q.where('num2', Q.lt(Q.column('num1')))],
    matching: [{ id: 'm1', num1: 10, num2: 5 }, { id: 'm2', num1: 5.1, num2: 5.09 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num2: null },
      { id: 'n4', num1: null, num2: null },
      { id: 'n5', num1: 5, num2: 10 },
      { id: 'n6', num1: 5 },
      { id: 'n7', num1: 5, num2: null },
      { id: 'n8', num2: 10 },
      { id: 'n9', num1: null, num2: 10 },
      { id: 'n10', num1: 4.5, num2: 4.6 },
    ],
  },
  {
    name: 'can compare columns (less-than-or-equal)',
    query: [Q.where('num2', Q.lte(Q.column('num1')))],
    matching: [{ id: 'm1', num1: 10, num2: 5 }, { id: 'm2', num1: 5, num2: 5 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num2: null },
      { id: 'n4', num1: null, num2: null },
      { id: 'n5', num1: 5, num2: 10 },
      { id: 'n6', num1: 5 },
      { id: 'n7', num1: 5, num2: null },
      { id: 'n8', num2: 10 },
      { id: 'n9', num1: null, num2: 10 },
    ],
  },
  {
    name: 'can compare columns (greater-than/float)',
    query: [Q.where('float1', Q.gt(Q.column('float2')))],
    matching: [{ id: 'm1', float1: 10, float2: 5 }, { id: 'm2', float1: 5.1, float2: 5.09 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', float1: null },
      { id: 'n3', float2: null },
      { id: 'n4', float1: null, float2: null },
      { id: 'n5', float1: 5, float2: 10 },
      { id: 'n6', float1: 5 },
      { id: 'n7', float1: 5, float2: null },
      { id: 'n8', float2: 10 },
      { id: 'n9', float1: null, float2: 10 },
      { id: 'n10', float1: 4.5, float2: 4.6 },
    ],
  },
  {
    name: 'can compare columns (greater-than-or-equal/integer)',
    query: [Q.where('num1', Q.gte(Q.column('num2')))],
    matching: [{ id: 'm1', num1: 10, num2: 5 }, { id: 'm2', num1: 5, num2: 5 }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num2: null },
      { id: 'n4', num1: null, num2: null },
      { id: 'n5', num1: 5, num2: 10 },
      { id: 'n6', num1: 5 },
      { id: 'n7', num1: 5, num2: null },
      { id: 'n8', num2: 10 },
      { id: 'n9', num1: null, num2: 10 },
    ],
  },
  {
    name: 'can compare columns (string/null)',
    query: [Q.where('text1', Q.eq(Q.column('text2')))],
    matching: [
      { id: 'm1', text1: null },
      { id: 'm2', text2: null },
      { id: 'm3', text1: null, text2: null },
      { id: 'm4', text1: undefined, text2: null },
      { id: 'm5', text1: 'hey', text2: 'hey' },
    ],
    nonMatching: [
      { id: 'n1', text1: '', text2: null },
      { id: 'n2', text2: '' },
      { id: 'n3', text1: 'hey' },
      { id: 'n4', text1: 'hey', text2: 'HEY' },
    ],
  },
  {
    name: 'can compare columns (greater-than with JS semantics)',
    query: [Q.where('num1', Q.weakGt(Q.column('num2')))],
    matching: [
      { id: 'm1', num1: 10, num2: 5 },
      { id: 'm2', num1: 5 },
      { id: 'm3', num1: 5, num2: null },
      { id: 'm4', num1: 5, num2: undefined },
      { id: 'm5', num1: 0 },
      { id: 'm6', num1: 0, num2: null },
    ],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', num1: null },
      { id: 'n3', num2: null },
      { id: 'n4', num1: null, num2: null },
      { id: 'n5', num1: 5, num2: 10 },
      { id: 'n8', num2: 10 },
      { id: 'n9', num1: null, num2: 10 },
    ],
  },
  {
    name: 'matches complex queries with AND/OR nesting',
    query: [
      Q.where('text1', 'value'),
      Q.or(
        Q.where('bool1', true),
        Q.where('text2', null),
        Q.and(Q.where('float1', Q.gt(5)), Q.where('float2', Q.notIn([6, 7]))),
      ),
    ],
    matching: [
      { id: 'm1', text1: 'value', bool1: true, text2: 'abc' },
      { id: 'm2', text1: 'value', bool1: false, text2: null },
      { id: 'm3', text1: 'value', bool1: false },
      { id: 'm4', text1: 'value', bool1: false, text2: 'abc', float1: 8, float2: 0 },
    ],
    nonMatching: [
      { id: 'n1', text1: 'bad', bool1: true },
      { id: 'n2', text1: 'value', text2: 'abc' },
      { id: 'n3', text1: 'value', bool1: false, text2: 'abc' },
      { id: 'n4', text1: 'value', text2: 'abc', float1: 4 },
      { id: 'n5', text1: 'value', text2: 'abc', float1: 5, float2: 0 },
      { id: 'n6', text1: 'value', text2: 'abc', float1: 6, float2: 6 },
      { id: 'n7', text1: 'value', text2: 'abc', float1: 19, float2: 7 },
      { id: 'n8', text1: 'value', bool1: false, text2: 'abc', float1: 8 },
      { id: 'n9', text1: 'value', bool1: false, text2: 'abc', float1: 8, float2: null },
    ],
  },
  {
    name: 'can match by less-than with JS semantics',
    query: [Q.or(Q.where('num1', Q.lt(2)), Q.where('num1', null))],
    matching: [{ id: 'm1', num1: 1 }, { id: 'm2', num1: null }, { id: 'm3' }],
    nonMatching: [{ id: 'n1', num1: 2 }],
  },
  {
    name: 'can match by NOT IN with JS semantics',
    query: [Q.or(Q.where('num1', Q.notIn([0, 1, 2])), Q.where('num1', null))],
    matching: [{ id: 'm1' }, { id: 'm2', num1: null }, { id: 'm3', num1: 10 }],
    nonMatching: [{ id: 'n1', num1: 0 }, { id: 'n2', num1: 2 }],
  },
  {
    name: 'match like (string)',
    query: [Q.where('text1', Q.like('%ipsum%'))],
    matching: [
      { id: 'm1', text1: 'Lorem ipsum dolor sit amet,' },
      { id: 'm2', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'm3', text1: 'Lorem\n\nIpsum' },
      { id: 'm4', text1: 'Lorem\n\nIpsum\nfoo' },
    ],
    nonMatching: [{ id: 'n1', text1: 'consectetur adipiscing elit.' }, { id: 'n2', text1: null }],
  },
  {
    name: 'match notLike (string)',
    query: [Q.where('text1', Q.notLike('%ipsum%'))],
    nonMatching: [
      { id: 'm1', text1: 'Lorem ipsum dolor sit amet,' },
      { id: 'm2', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'm3', text1: 'Lorem\n\nIpsum' },
      { id: 'm4', text1: 'Lorem\n\nIpsum\nfoo' },
      { id: 'mZ', text1: null },
    ],
    matching: [{ id: 'n1', text1: 'consectetur adipiscing elit.' }],
  },
  {
    name: 'match like (value%)',
    query: [Q.where('text1', Q.like('Lorem%'))],
    matching: [{ id: 'm1', text1: 'Lorem Ipsum dolor sit amet,' }],
    nonMatching: [
      { id: 'n1', text1: 'consectetur adipiscing elit.' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n3', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      {
        id: 'n4',
        text1: 'Integer accumsan tincidunt velit \nLorem, eu fermentum lorem mollis at.',
      },
      { id: 'n5', text1: null },
    ],
  },
  {
    name: 'match notLike (value%)',
    query: [Q.where('text1', Q.notLike('Lorem%'))],
    nonMatching: [{ id: 'm1', text1: 'Lorem Ipsum dolor sit amet,' }, { id: 'm2', text1: null }],
    matching: [
      { id: 'n1', text1: 'consectetur adipiscing elit.' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n3', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      {
        id: 'n4',
        text1: 'Integer accumsan tincidunt velit \nLorem, eu fermentum lorem mollis at.',
      },
    ],
  },
  {
    name: 'match like (%value)',
    query: [Q.where('text1', Q.like('%Lorem'))],
    matching: [
      { id: 'm1', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'm2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue\n\nLorem' },
    ],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'consectetur adipiscing elit.' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'Integer accumsan tincidunt velit, lorem\neu fermentum lorem mollis at.' },
      { id: 'nZ', text1: null },
    ],
  },
  {
    name: 'match notLike (%value)',
    query: [Q.where('text1', Q.notLike('%Lorem'))],
    nonMatching: [
      { id: 'm1', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'm2', text1: null },
    ],
    matching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'consectetur adipiscing elit.' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
    ],
  },
  {
    name: 'match like (value%value)',
    query: [Q.where('text1', Q.like('lorem%elit'))],
    matching: [{ id: 'm1', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit' }],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match notLike (value%value)',
    query: [Q.where('text1', Q.notLike('lorem%elit'))],
    nonMatching: [
      { id: 'm1', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit' },
      { id: 'm2', text1: null },
    ],
    matching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
    ],
  },
  {
    name: 'match like (value%value%)',
    query: [Q.where('text1', Q.like('lorem%elit%'))],
    matching: [
      { id: 'm1', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit' },
      { id: 'm2', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit.' },
    ],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match notLike (value%value%)',
    query: [Q.where('text1', Q.notLike('lorem%elit%'))],
    nonMatching: [
      { id: 'm1', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit' },
      { id: 'm2', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit.' },
      { id: 'm3', text1: null },
    ],
    matching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
    ],
  },
  {
    name: 'match like (v_lue%v_lue%)',
    query: [Q.where('text1', Q.like('l_rem%e_it%'))],
    matching: [
      { id: 'm1', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit' },
      { id: 'm2', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit.' },
      { id: 'm3', text1: 'Larem Ipsum dolor sit amet, consectetur adipiscing epit.' },
    ],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match notLike (v_lue%v_lue%)',
    query: [Q.where('text1', Q.notLike('l_rem%e_it%'))],
    nonMatching: [
      { id: 'm1', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit' },
      { id: 'm2', text1: 'Lorem Ipsum dolor sit amet, consectetur adipiscing elit.' },
      { id: 'm3', text1: 'Larem Ipsum dolor sit amet, consectetur adipiscing epit.' },
      { id: 'm4', text1: null },
    ],
    matching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
    ],
  },
  {
    name: 'match like (_alu_)',
    query: [Q.where('text1', Q.like('_ore_'))],
    matching: [{ id: 'm1', text1: 'Lorem' }, { id: 'm2', text1: 'poret' }],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match like sanitized (value%)',
    query: [Q.where('text1', Q.like(Q.sanitizeLikeString('lorem%')))],
    matching: [{ id: 'm2', text1: 'Lorem%' }],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match like sanitized (value_)',
    query: [Q.where('text1', Q.like(Q.sanitizeLikeString('lorem_')))],
    matching: [{ id: 'm2', text1: 'Lorem%' }],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match like sanitized (value.*)',
    query: [Q.where('text1', Q.like(Q.sanitizeLikeString('lorem.*')))],
    matching: [{ id: 'm2', text1: 'Lorem.*' }],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'n3', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
      { id: 'n4', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n5', text1: 'consectetur adipiscing elit.' },
      { id: 'n6', text1: null },
    ],
  },
  {
    name: 'match like sanitized (%(value,)%)',
    query: [Q.where('text1', Q.like(`%${Q.sanitizeLikeString('commodo,')}%`))],
    matching: [
      { id: 'm1', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem' },
      { id: 'm2', text1: 'Vestibulum eget felis commodo, gravida velit nec, congue lorem.' },
    ],
    nonMatching: [
      { id: 'n1', text1: 'Lorem Ipsum dolor sit amet,' },
      { id: 'n2', text1: 'Integer accumsan tincidunt velit, eu fermentum lorem mollis at.' },
      { id: 'n3', text1: 'consectetur adipiscing elit.' },
      { id: 'n4', text1: null },
    ],
  },
  {
    name: 'match unsafe SQL expression',
    query: [Q.unsafeSqlExpr('tasks.num1 not between 1 and 5')],
    matching: [
      { id: 'm1', num1: 0 },
      { id: 'm2', num1: -1 },
      { id: 'm3', num1: 6 },
      { id: 'm4', num1: 10 },
    ],
    nonMatching: [{ id: 'n1', num1: 1 }, { id: 'n2', num1: 3 }, { id: 'n3', num1: 5 }],
    skipLoki: true,
    skipMatcher: true,
  },
  {
    name: 'match unsafe Loki expression',
    query: [Q.unsafeLokiExpr({ text1: { $contains: 'hey' } })],
    matching: [{ id: 'm1', text1: 'hey' }, { id: 'm2', text1: 'aeheyea' }],
    nonMatching: [{ id: 'n1' }, { id: 'n2', text1: 'he' }],
    skipSqlite: true,
    skipMatcher: true,
  },
  {
    name: 'match with sortBy & take',
    query: [
      Q.experimentalSortBy('text1', 'asc'),
      Q.experimentalSortBy('num1', 'desc'),
      Q.experimentalTake(2),
    ],
    matching: [
      // TODO: null handling?
      { id: 'n2', text1: 'a', num1: 1 },
      { id: 'n1', text1: 'a', num1: 2 },
    ],
    nonMatching: [
      { id: 'n3', text1: 'c', num1: 4 },
      { id: 'm2', text1: 'b', num1: 2 },
      { id: 'm1', text1: 'b', num1: 10 },
      { id: 'n4', text1: 'c', num1: 3 },
    ],
    skipLoki: true,
    skipCount: true, // count is broken
    skipMatcher: true,
  },
  {
    name: 'match with sortBy, take & skip',
    query: [
      Q.experimentalSortBy('text1', 'asc'),
      Q.experimentalSortBy('num1', 'desc'),
      Q.experimentalSkip(2),
      Q.experimentalTake(2),
    ],
    matching: [
      // TODO: null handling?
      { id: 'm2', text1: 'b', num1: 2 },
      { id: 'm1', text1: 'b', num1: 10 },
    ],
    nonMatching: [
      { id: 'n3', text1: 'c', num1: 4 },
      { id: 'n4', text1: 'c', num1: 3 },
      { id: 'n1', text1: 'a', num1: 2 },
      { id: 'n2', text1: 'a', num1: 1 },
    ],
    skipLoki: true,
    skipCount: true, // count is broken
    skipMatcher: true,
  },
  // TODO: Order, not match tests for sortBy, take, skip
]

export const naughtyMatchTests = naughtyStrings.map(naughtyString => ({
  name: naughtyString,
  query: [Q.where('text1', naughtyString)],
  matching: [{ id: 'm1', text1: naughtyString }],
  nonMatching: [{ id: 'n1', text1: null }, { id: 'n2', text1: 'not-a-naughty-string' }],
}))

export const joinTests = [
  {
    name: 'can perform simple JOIN queries',
    query: [Q.on('projects', 'text1', 't1')],
    extraRecords: {
      projects: [
        { id: 'p1', text1: 't1' },
        { id: 'p2', text1: 't1' },
        // bad:
        { id: 'p3', text1: 't2' },
        { id: 'p4', text1: 't1', _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1' },
      { id: 'm2', project_id: 'p1' },
      { id: 'm3', project_id: 'p2' },
    ],
    nonMatching: [
      { id: 'm4', project_id: 'p3' },
      { id: 'm5', project_id: 'p4' },
      { id: 'm6', project_id: 'p1', _status: 'deleted' },
    ],
  },
  {
    name: 'can perform complex JOIN queries',
    query: [
      Q.on('projects', 'text1', 'abcdef'),
      Q.where('text1', 'val1'),
      Q.on('tag_assignments', 'text1', Q.oneOf(['a', 'b', 'c'])),
      Q.on('projects', 'bool1', true),
    ],
    extraRecords: {
      projects: [
        { id: 'p2', text1: 'abcdef', bool1: true },
        { id: 'p3', text1: 'abcdef', bool1: true },
        // bad:
        { id: 'p1', text1: 'abcdef', bool1: false },
        { id: 'p4', text1: 'other', bool1: true },
        { id: 'p5', text1: 'abcdef', bool1: true, _status: 'deleted' },
      ],
      tag_assignments: [
        { id: 'tt1', text1: 'a', task_id: 'm1' },
        { id: 'tt2', text1: 'a', task_id: 'm2' },
        { id: 'tt3', text1: 'b', task_id: 'm1' },
        { id: 'tt4', text1: 'c', task_id: 'm3' },
        { id: 'tt5', text1: 'c', task_id: 'm4' },
        { id: 'tt6', text1: 'c', task_id: 'n1' },
        { id: 'tt7', text1: 'c', task_id: 'n2' },
        // bad:
        { id: 'tt8', text1: 'd', task_id: 'm4' },
        { id: 'tt9', text1: 'd', task_id: 'n4' },
        { id: 'tt10', text1: 'c', task_id: 'n7', _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', text1: 'val1', project_id: 'p2' },
      { id: 'm2', text1: 'val1', project_id: 'p2' },
      { id: 'm3', text1: 'val1', project_id: 'p3' },
      { id: 'm4', text1: 'val1', project_id: 'p3' },
    ],
    nonMatching: [
      { id: 'n1', text1: 'other', project_id: 'p2' },
      { id: 'n2', text1: 'val1', project_id: 'p1' }, // bad project
      { id: 'n3', text1: 'val1', project_id: 'p4' }, // bad project
      { id: 'n4', text1: 'val1', project_id: 'p2' }, // bad task_assignment
      { id: 'n5', text1: 'val1', project_id: 'p3' }, // no task_assignment
      { id: 'n6', text1: 'val1', project_id: 'p5' }, // bad project
      { id: 'n7', text1: 'val1', project_id: 'p2' }, // bad task_assignment
    ],
  },
  {
    name: `can perform Q.on with subexpressions`,
    query: [
      Q.on('projects', [
        Q.where('text1', 'foo'),
        Q.or(Q.where('num1', 2137), Q.where('bool1', true)),
      ]),
    ],
    extraRecords: {
      projects: [
        { id: 'p1', text1: 'foo', num1: 2137 },
        { id: 'p2', text1: 'foo', bool1: true },
        { id: 'p3', text1: 'foo', num1: 2137, bool1: true },
        { id: 'badp1', text1: 'foo' },
        { id: 'badp2', num1: 2137 },
        { id: 'badp3', text1: 'foo', num1: 2137, _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1' },
      { id: 'm2', project_id: 'p2' },
      { id: 'm3', project_id: 'p3' },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'badp1' },
      { id: 'n2', project_id: 'badp2' },
      { id: 'n3', project_id: 'badp3' },
      { id: 'n4', project_id: 'p1', _status: 'deleted' },
    ],
  },
  {
    name: `can perform Q.on's nested in Q.or and Q.and`,
    query: [
      Q.experimentalJoinTables(['projects', 'tag_assignments']),
      Q.or(
        Q.where('bool1', true),
        Q.on('projects', 'bool1', true),
        Q.and(Q.on('tag_assignments', 'text1', 'foo')),
      ),
    ],
    extraRecords: {
      projects: [
        { id: 'p1', bool1: true },
        // bad:
        { id: 'badp1', bool1: false },
        { id: 'badp2', bool1: true, _status: 'deleted' },
      ],
      tag_assignments: [
        { id: 'tt1', text1: 'foo', task_id: 'm6' },
        { id: 'tt2', text1: 'foo', task_id: 'm8' },
        { id: 'badtt1', text1: 'foo', task_id: 'm7', _status: 'deleted' },
        { id: 'badtt2', text1: 'foo', task_id: 'n5', _status: 'deleted' },
        { id: 'badtt3', text1: 'blah', task_id: 'n6' },
      ],
    },
    matching: [
      { id: 'm1', bool1: true },
      { id: 'm2', bool1: true, project_id: 'p1' },
      { id: 'm3', bool1: true, project_id: 'badp1' },
      { id: 'm4', bool1: true, project_id: 'badp2' },
      { id: 'm5', bool1: false, project_id: 'p1' },
      { id: 'm6', bool1: false }, // via TT
      { id: 'm7', bool1: true }, // has TT
      { id: 'm8', bool1: true, project_id: 'p1' }, // has TT
    ],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2', bool1: false },
      { id: 'n3', project_id: 'badp1' },
      { id: 'n4', project_id: 'badp2' },
      { id: 'n5' }, // bad TT
      { id: 'n6' }, // bad TT
    ],
  },
  {
    name: `can perform Q.on's nested in Q.on`,
    query: [
      Q.experimentalNestedJoin('projects', 'teams'),
      Q.on('projects', Q.on('teams', 'text1', 'bingo')),
    ],
    extraRecords: {
      projects: [
        { id: 'p1', team_id: 't1' },
        { id: 'p2', team_id: 't2' },
        { id: 'badp1', team_id: 'badt1' },
        { id: 'badp2', team_id: 'badt2' },
        { id: 'badp3', team_id: 't2', _status: 'deleted' },
      ],
      teams: [
        { id: 't1', text1: 'bingo' },
        { id: 't2', text1: 'bingo' },
        { id: 'badt1' },
        { id: 'badt2', text1: 'bingo', _status: 'deleted' },
      ],
    },
    matching: [{ id: 'm1', project_id: 'p1' }, { id: 'm2', project_id: 'p2' }],
    nonMatching: [
      { id: 'n1', project_id: 'badp1' },
      { id: 'n2', project_id: 'badp2' },
      { id: 'n3', project_id: 'badp3' },
      { id: 'n4', project_id: 'p1', _status: 'deleted' },
    ],
  },
  {
    name: `can perform deeply nested Q.ons`,
    query: [
      Q.experimentalJoinTables(['projects']),
      Q.experimentalNestedJoin('projects', 'teams'),
      Q.experimentalNestedJoin('teams', 'organizations'),
      Q.or(
        Q.where('text1', 'BINGO'),
        Q.on(
          'projects',
          Q.on('teams', [
            Q.where('bool1', true),
            Q.or(Q.where('text1', 'GUDTIM'), Q.on('organizations', 'num1', 2137)),
          ]),
        ),
      ),
    ],
    extraRecords: {
      projects: [
        { id: 'p1', team_id: 't1' },
        { id: 'p2', team_id: 't2' },
        { id: 'badp1', team_id: 'badt1' },
        { id: 'badp2', team_id: 'badt2' },
        { id: 'badp3', team_id: 'badt3' },
        { id: 'badp4', team_id: 'badt4' },
        { id: 'badp5', team_id: 'badt5' },
        { id: 'badp6', team_id: 't2', _status: 'deleted' },
      ],
      teams: [
        { id: 't1', bool1: true, text1: 'GUDTIM' },
        { id: 't2', bool1: true, organization_id: 'o1' },
        { id: 'badt1', bool1: true },
        { id: 'badt2', text1: 'GUDTIM' },
        { id: 'badt3', bool1: true, organization_id: 'o1', _status: 'deleted' },
        { id: 'badt4', bool1: true, organization_id: 'bado1' },
        { id: 'badt5', bool1: true, organization_id: 'bado2' },
      ],
      organizations: [
        { id: 'o1', num1: 2137 },
        { id: 'bado1' },
        { id: 'bado2', num1: 2137, _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1' },
      { id: 'm2', project_id: 'p2' },
      { id: 'm3', text1: 'BINGO' },
      { id: 'm4', text1: 'BINGO', project_id: 'badp1' },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'badp1' },
      { id: 'n2', project_id: 'badp2' },
      { id: 'n3', project_id: 'badp3' },
      { id: 'n4', project_id: 'badp4' },
      { id: 'n5', project_id: 'badp5' },
      { id: 'n6', project_id: 'badp6' },
      { id: 'n9', text1: 'BINGO', project_id: 'p1', _status: 'deleted' },
    ],
  },
  {
    name: 'can perform both JOIN queries and column comparisons',
    query: [Q.on('projects', 'text1', 't1'), Q.where('text1', Q.eq(Q.column('text2')))],
    extraRecords: {
      projects: [{ id: 'p1', text1: 't1' }, { id: 'p2', text1: 't1' }, { id: 'p3', text1: 't2' }],
    },
    matching: [
      { id: 'm1', project_id: 'p1', text1: 'a', text2: 'a' },
      { id: 'm2', project_id: 'p1', text1: null },
      { id: 'm3', project_id: 'p2', text1: 'Foo', text2: 'Foo' },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'p3' },
      { id: 'n2', project_id: 'p3', text1: 'a', text2: 'a' },
      { id: 'n3', project_id: 'p1', text1: 'a', text2: 'b' },
      { id: 'n4', project_id: 'p2', text1: 'foo', text2: 'Foo' },
      { id: 'n5', project_id: 'p1', text1: null, text2: false },
    ],
  },
  {
    name: 'can perform a JOIN query containing column comparison',
    query: [
      Q.where('text1', 'val1'),
      Q.on('projects', 'text1', 'val2'),
      Q.on('projects', 'text2', Q.eq(Q.column('text3'))),
    ],
    extraRecords: {
      projects: [
        { id: 'p1', text1: 'val2', text2: 'a', text3: 'a' },
        { id: 'p2', text1: 'val2', text2: null },
        { id: 'p3', text1: 'val2' },
        // bad:
        { id: 'badp1' },
        { id: 'badp2', text2: 'a', text3: 'b' },
        { id: 'badp3', text1: 'val2', text2: 'a', text3: 'b' },
        { id: 'badp4', text1: 'val2', text2: 'a', text3: 'a', _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1', text1: 'val1' },
      { id: 'm2', project_id: 'p2', text1: 'val1' },
      { id: 'm3', project_id: 'p3', text1: 'val1' },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'p3' },
      { id: 'n2', project_id: 'p2', text1: 'bad' },
      { id: 'n3', project_id: 'badp1', text1: 'val1' },
      { id: 'n4', project_id: 'badp2', text1: 'val1' },
      { id: 'n5', project_id: 'badp3', text1: 'val1' },
      { id: 'n6', project_id: 'badp3' },
      { id: 'n7', project_id: 'badp4', text1: 'val1' },
    ],
  },
  {
    name: 'can perform a JOIN query containing weakGt column comparison',
    query: [Q.on('projects', 'num1', Q.weakGt(Q.column('num2')))],
    extraRecords: {
      projects: [
        { id: 'p1', num1: 10, num2: 5 },
        { id: 'p2', num1: 5 },
        { id: 'p3', num1: 5, num2: null },
        { id: 'p4', num1: 5, num2: undefined },
        { id: 'p5', num1: 0 },
        { id: 'p6', num1: 0, num2: null },

        { id: 'badp1' },
        { id: 'badp2', num1: null },
        { id: 'badp3', num2: null },
        { id: 'badp4', num1: null, num2: null },
        { id: 'badp5', num1: 5, num2: 10 },
        { id: 'badp6', num2: 10 },
        { id: 'badp7', num1: null, num2: 10 },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1' },
      { id: 'm2', project_id: 'p2' },
      { id: 'm3', project_id: 'p3' },
      { id: 'm4', project_id: 'p4' },
      { id: 'm5', project_id: 'p5' },
      { id: 'm6', project_id: 'p6' },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'badp1' },
      { id: 'n2', project_id: 'badp2' },
      { id: 'n3', project_id: 'badp3' },
      { id: 'n4', project_id: 'badp4' },
      { id: 'n5', project_id: 'badp5' },
      { id: 'n6', project_id: 'badp6' },
      { id: 'n7', project_id: 'badp7' },
    ],
  },
  {
    name: 'can perform a JOIN query on has_many collection with column comparisons',
    query: [Q.where('text1', 'val1'), Q.on('tag_assignments', 'num1', Q.gt(Q.column('num2')))],
    extraRecords: {
      tag_assignments: [
        { id: 'tt1', task_id: 'm1', num1: 5, num2: 0 },
        { id: 'tt2', task_id: 'm2', num1: 10, num2: 5 },
        { id: 'tt3', task_id: 'n1', num1: 5, num2: 0 },
        { id: 'tt4', task_id: 'n2', num1: 10, num2: 5 },
        { id: 'badtt1', task_id: 'n3', num1: 0, num2: 0 },
        { id: 'badtt2', task_id: 'n4' },
        { id: 'badtt3', task_id: 'n5', num1: 10, num2: 10 },
        { id: 'badtt4', task_id: 'n6', num1: 0, num2: 15 },
        { id: 'badtt5', task_id: 'n9', num1: 10, num2: 5, _status: 'deleted' },
      ],
    },
    matching: [{ id: 'm1', text1: 'val1' }, { id: 'm2', text1: 'val1' }],
    nonMatching: [
      { id: 'n1' },
      { id: 'n2' },
      { id: 'n3', text1: 'val1' },
      { id: 'n4', text1: 'val1' },
      { id: 'n5', text1: 'val1' },
      { id: 'n6', text1: 'val1' },
      { id: 'n7', text1: 'val1' }, // no TT
      { id: 'n8' }, // no TT
      { id: 'n9', text1: 'val1' }, // bad TT
    ],
  },
  {
    name: `can perform deeply nested JOIN query with a column comparison`,
    query: [
      Q.experimentalJoinTables(['projects']),
      Q.experimentalNestedJoin('projects', 'teams'),
      Q.or(Q.on('projects', Q.on('teams', [Q.where('num1', Q.gt(Q.column('num2')))]))),
    ],
    extraRecords: {
      teams: [
        { id: 't1', num1: 10, num2: 5 },
        { id: 't2', num1: 5, num2: -5 },
        { id: 'badt1', num1: 5, num2: 10 },
        { id: 'badt2', num1: 5, num2: null },
        { id: 'badt3', num1: null, num2: null },
      ],
      projects: [
        { id: 'p1', team_id: 't1' },
        { id: 'p2', team_id: 't2' },
        { id: 'badp1', team_id: 'badt1' },
        { id: 'badp2', team_id: 'badt2' },
        { id: 'badp3', team_id: 'badt3' },
      ],
    },
    matching: [{ id: 'm1', project_id: 'p1' }, { id: 'm2', project_id: 'p2' }],
    nonMatching: [
      { id: 'n1', project_id: 'badp1' },
      { id: 'n2', project_id: 'badp2' },
      { id: 'n3', project_id: 'badp3' },
    ],
  },
  {
    name: 'can compare columns between tables using unsafe SQL expressions',
    query: [Q.on('projects', 'num1', Q.notEq(null)), Q.unsafeSqlExpr('tasks.num1 > projects.num1')],
    extraRecords: {
      projects: [
        { id: 'p1', num1: 5 },
        { id: 'p2', num1: 10 },
        { id: 'badp1' },
        { id: 'badp2', num1: 5, _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1', num1: 5.01 },
      { id: 'm2', project_id: 'p1', num1: 100 },
      { id: 'm3', project_id: 'p2', num1: 11 },
      { id: 'm4', project_id: 'p2', num1: 10e12 },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'p1', num1: 0 },
      { id: 'n2', project_id: 'p1', num1: -10 },
      { id: 'n3', project_id: 'p1', num1: 4.99 },
      { id: 'n4', project_id: 'p2', num1: 9 },
      { id: 'n5', project_id: 'badp2', num1: 100 },
      { id: 'n6', project_id: 'badp1', num1: 100 },
      { id: 'n7', project_id: 'p1', num1: 100, _status: 'deleted' },
      { id: 'n8', project_id: 'p1' },
    ],
    skipLoki: true,
  },
  {
    name: 'can compare columns between tables using unsafe Loki filter',
    query: [
      Q.on('projects', 'num1', Q.notEq(null)),
      Q.unsafeLokiFilter((record, loki) => {
        const project = loki.getCollection('projects').by('id', record.project_id)
        return project && typeof record.num1 === 'number' && record.num1 > project.num1
      }),
    ],
    extraRecords: {
      projects: [
        { id: 'p1', num1: 5 },
        { id: 'p2', num1: 10 },
        { id: 'badp1' },
        { id: 'badp2', num1: 5, _status: 'deleted' },
      ],
    },
    matching: [
      { id: 'm1', project_id: 'p1', num1: 5.01 },
      { id: 'm2', project_id: 'p1', num1: 100 },
      { id: 'm3', project_id: 'p2', num1: 11 },
      { id: 'm4', project_id: 'p2', num1: 10e12 },
    ],
    nonMatching: [
      { id: 'n1', project_id: 'p1', num1: 0 },
      { id: 'n2', project_id: 'p1', num1: -10 },
      { id: 'n3', project_id: 'p1', num1: 4.99 },
      { id: 'n4', project_id: 'p2', num1: 9 },
      { id: 'n5', project_id: 'badp2', num1: 100 },
      { id: 'n6', project_id: 'badp1', num1: 100 },
      { id: 'n7', project_id: 'p1', num1: 100, _status: 'deleted' },
      { id: 'n8', project_id: 'p1' },
    ],
    skipSqlite: true,
  },
]
