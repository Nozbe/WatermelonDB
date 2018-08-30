const resolve = require('rollup-plugin-node-resolve')
const commonjs = require('rollup-plugin-commonjs')
const babel = require('rollup-plugin-babel')
const replace = require('rollup-plugin-replace')
const { terser } = require('rollup-plugin-terser')

const { rollupRx, rxExternalPaths } = require('./rollup.rx')

module.exports = options => {
  const { env } = options
  const isDevelopment = env === 'development'

  return {
    external: [
      'lokijs',
      'lokijs/src/loki-indexed-adapter',
      'react-native',
      'async',
      'rxjs',
      'rxjs/operators',
      'rambdax',
      'sql-escape-string',
      ...rxExternalPaths,
    ],
    experimentalCodeSplitting: true,
    treeshake: true,
    plugins: [
      rollupRx(),
      resolve({
        customResolveOptions: {
          moduleDirectory: ['node_modules'],
        },
      }),
      babel({
        runtimeHelpers: true,
        exclude: 'node_modules/**',
      }),
      commonjs(),
      replace({
        'process.env.NODE_ENV': JSON.stringify(env),
      }),
      ...(isDevelopment ? [] : [terser()]),
    ],
  }
}
