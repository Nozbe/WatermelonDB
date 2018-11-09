// Adapted from React Native
const standardPlugins = [
  '@babel/plugin-proposal-optional-catch-binding',
  '@babel/plugin-transform-block-scoping',
  // the flow strip types plugin must go BEFORE class properties!
  // there'll be a test case that fails if you don't.
  '@babel/plugin-transform-flow-strip-types',
  [
    '@babel/plugin-proposal-class-properties',
    // use `this.foo = bar` instead of `this.defineProperty('foo', ...)`
    { loose: true },
  ],
  '@babel/plugin-syntax-dynamic-import',
  '@babel/plugin-syntax-export-default-from',
  [
    '@babel/plugin-transform-computed-properties',
    {
      // 2-3x faster, unlikely to be an issue
      loose: true,
    },
  ],
  '@babel/plugin-transform-destructuring',
  '@babel/plugin-transform-function-name',
  '@babel/plugin-transform-literals',
  '@babel/plugin-transform-parameters',
  '@babel/plugin-transform-shorthand-properties',
  '@babel/plugin-transform-react-jsx',
  '@babel/plugin-transform-regenerator',
  '@babel/plugin-transform-sticky-regex',
  '@babel/plugin-transform-unicode-regex',
  [
    '@babel/plugin-transform-modules-commonjs',
    {
      strict: false,
      strictMode: false, // prevent "use strict" injections
      allowTopLevelThis: true, // dont rewrite global `this` -> `undefined`
    },
  ],
  '@babel/plugin-proposal-export-default-from',
  '@babel/plugin-transform-classes',
  '@babel/plugin-transform-arrow-functions',
  '@babel/plugin-transform-spread',
  '@babel/plugin-proposal-object-rest-spread',
  [
    '@babel/plugin-transform-template-literals',
    { loose: true }, // dont 'a'.concat('b'), just use 'a'+'b'
  ],
  '@babel/plugin-transform-exponentiation-operator',
  '@babel/plugin-transform-object-assign',
  ['@babel/plugin-transform-for-of', { loose: true }],
  ['@babel/plugin-proposal-optional-chaining', { loose: true }],
  ['@babel/plugin-proposal-nullish-coalescing-operator', { loose: true }],
  [
    '@babel/plugin-transform-runtime',
    {
      helpers: true,
      regenerator: true,
    },
  ],
]

const plugins = [
  ['@babel/plugin-proposal-decorators', { legacy: true }],

  ...standardPlugins,

  // Custom transformations
  '@babel/plugin-proposal-json-strings',
  // TODO: Changed fast-async back to regenerator because of an Android React Native issue :/ #138
  '@babel/plugin-transform-async-to-generator',
  // [
  //   // TODO: We can get this faster by tweaking with options, but have to test thoroughly...
  //   'module:fast-async',
  //   {
  //     spec: true,
  //   },
  // ],
]

module.exports = {
  env: {
    development: {
      plugins,
    },
    production: {
      plugins: [
        ...plugins,
        // ['transform-remove-console', { exclude: ['error', 'warn'] }],
        'minify-flip-comparisons',
        'minify-guarded-expressions',
        'minify-dead-code-elimination',
      ],
    },
    test: {
      plugins: [...plugins, '@babel/plugin-syntax-jsx'],
    },
  },
}
