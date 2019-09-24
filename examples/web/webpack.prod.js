const Webpack = require('webpack')
const WebpackClean = require('clean-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const uglifyJsPkg = require('uglify-js/package.json')

const path = require('path')

const merge = require('webpack-merge')
const config = require('./webpack.common')

const resolvePath = (...paths) => path.resolve(__dirname, ...paths)

module.exports = merge(config, {
  mode: 'production',
  output: {
    path: resolvePath('public'),
  },
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        parallel: true,
        cache: true,
        sourceMap: true,
        cacheKeys: defaultCacheKeys => {
          delete defaultCacheKeys['uglify-js']
          return {
            ...defaultCacheKeys,
            'uglify-js': uglifyJsPkg.version,
          }
        },
        minify: (file, sourceMap) => {
          const uglifyJsOptions = {
            output: {
              comments: false,
            },
          }
          if (sourceMap) {
            uglifyJsOptions.sourceMap = {
              content: sourceMap,
            }
          }
          // eslint-disable-next-line
          return require('terser').minify(file, uglifyJsOptions)
        },
      }),
    ],
    splitChunks: {
      chunks: 'initial',
      minSize: 30000,
      minChunks: 1,
      maxInitialRequests: 3,
      name: true,
      cacheGroups: {
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
        },
      },
    },
    runtimeChunk: true,
  },
  plugins: [
    new WebpackClean([resolvePath('public')]),
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ],
})
