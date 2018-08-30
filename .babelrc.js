const { join } = require('rambdax')

const redirect = (...paths) => join('/', ['@nozbe', 'watermelondb', ...paths])

const plugins = [
  'annotate-pure-calls',
  [
    '@babel/plugin-transform-runtime',
    {
      helpers: true,
      regenerator: true,
    },
  ],
  // decorators
  ['@babel/plugin-proposal-decorators', { legacy: true }],
  '@babel/plugin-transform-flow-strip-types',
  ['@babel/plugin-proposal-class-properties', { loose: true }],
  // stage-3
  '@babel/plugin-syntax-dynamic-import',
  '@babel/plugin-proposal-json-strings',
  '@babel/plugin-proposal-object-rest-spread',
  '@babel/plugin-proposal-unicode-property-regex',
  // See http://incaseofstairs.com/six-speed/ for speed comparison between native and transpiled ES6
  '@babel/plugin-proposal-optional-chaining',
  '@babel/plugin-transform-template-literals',
  '@babel/plugin-transform-literals',
  '@babel/plugin-transform-function-name',
  '@babel/plugin-transform-arrow-functions',
  [
    '@babel/plugin-transform-computed-properties',
    {
      // 2-3x faster, unlikely to be an issue
      loose: true,
    },
  ],
  '@babel/plugin-transform-sticky-regex',
  '@babel/plugin-transform-unicode-regex',
  [
    // TODO: We can get this faster by tweaking with options, but have to test thoroughly...
    'module:fast-async',
    {
      spec: true,
    },
  ],
]

const importRedirect = [
  'import-redirect',
  {
    redirect: {
      '(adapters|decorators|utils|observation)(.+(?=\\/index\\.js)|.+(?=\\.js)|.+)': redirect(
        '$1$2',
      ),
      Collection$: redirect('Collection'),
      CollectionMap$: redirect('CollectionMap'),
      Database$: redirect('Database'),
      Model$: redirect('Model'),
      Query$: redirect('Query'),
      QueryDescription$: redirect('QueryDescription'),
      RawRecord$: redirect('RawRecord'),
      Relation$: redirect('Relation'),
      Schema$: redirect('Schema'),
    },
    suppressResolveWarning: true,
  },
]

module.exports = {
  env: {
    development: {
      plugins: [importRedirect, ...plugins],
    },
    production: {
      plugins: [
        importRedirect,
        ...plugins,
        // console.log is expensive for performance on native
        // we don't want it on web either, but it's useful for development
        ['transform-remove-console', { exclude: ['error', 'warn'] }],
        'minify-flip-comparisons',
        'minify-guarded-expressions',
        'minify-dead-code-elimination',
      ],
    },
    test: {
      plugins: ['@babel/plugin-transform-modules-commonjs', ...plugins],
    },
  },
}
