const path = require('path')
const fs = require('fs-extra')

const readNodeModulesDir = (...paths) =>
  fs.readdirSync(path.resolve(__dirname, 'node_modules', ...paths))
const rambdaxModules = readNodeModulesDir('rambdax', 'src')
const rambdaModules = readNodeModulesDir('rambdax', 'src', 'rambda')

const getRambdaPath = ({ importName }) => {
  if (rambdaModules.includes(`${importName}.js`)) {
    return `rambdax/src/rambda/${importName}`
  } else if (rambdaxModules.includes(`${importName}.js`)) {
    return `rambdax/src/${importName}`
  }

  throw new Error(`Unknown import of ${importName} from rambdax`)
}

const plugins = [
  [
    '@babel/plugin-transform-runtime',
    {
      helpers: true,
      // regenerator: true,
    },
  ],
  [
    'transform-imports',
    {
      rambdax: {
        transform: importName => getRambdaPath({ importName }),
        preventFullImport: true,
        skipDefaultConversion: true,
      },
    },
  ],
  [
    '@babel/plugin-transform-modules-commonjs',
    {
      loose: true, // improves speed & code size; unlikely to be a problem
      strict: false,
      strictMode: true,
      allowTopLevelThis: true,
      // this would improve speed&code size but breaks 3rd party code. can we apply it to our paths only?
      // (same with struct: true)
      // noInterop: true,
    },
  ],
  ['@babel/plugin-proposal-decorators', { legacy: true }],
  '@babel/plugin-transform-flow-strip-types',
  ['@babel/plugin-proposal-class-properties', { loose: true }],
  [
    '@babel/plugin-transform-classes',
    {
      loose: true, // spits out cleaner and faster output
    },
  ],
  '@babel/plugin-syntax-dynamic-import',
  '@babel/plugin-transform-block-scoping',
  '@babel/plugin-proposal-json-strings',
  '@babel/plugin-proposal-unicode-property-regex',
  // See http://incaseofstairs.com/six-speed/ for speed comparison between native and transpiled ES6
  '@babel/plugin-proposal-optional-chaining',
  '@babel/plugin-transform-template-literals',
  '@babel/plugin-transform-literals',
  '@babel/plugin-transform-function-name',
  '@babel/plugin-transform-arrow-functions',
  '@babel/plugin-proposal-nullish-coalescing-operator',
  '@babel/plugin-transform-shorthand-properties',
  '@babel/plugin-transform-spread',
  [
    '@babel/plugin-proposal-object-rest-spread',
    {
      // use fast Object.assign
      loose: true,
    },
  ],
  '@babel/plugin-transform-react-jsx',
  [
    '@babel/plugin-transform-computed-properties',
    {
      // 2-3x faster, unlikely to be an issue
      loose: true,
    },
  ],
  '@babel/plugin-transform-sticky-regex',
  '@babel/plugin-transform-unicode-regex',
  // TODO: fast-async is faster and cleaner, but causes a weird issue on older Android RN targets without jsc-android
  // '@babel/plugin-transform-async-to-generator',
  [
    // TODO: We can get this faster by tweaking with options, but have to test thoroughly...
    'module:fast-async',
    {
      spec: true,
    },
  ],
]

module.exports = {
  env: {
    development: {
      plugins,
    },
    production: {
      plugins: [
        ...plugins,
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
