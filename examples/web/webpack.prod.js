const Webpack = require('webpack')
const WebpackClean = require('clean-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const OptimizeJsPlugin = require('optimize-js-plugin')

const path = require('path')

const merge = require('webpack-merge')
const config = require('./webpack.common')

const resolvePath = (...paths) => path.resolve(__dirname, ...paths)

module.exports = merge(config, {
  mode: 'production',
  output: {
    path: resolvePath('build'),
  },
  optimization: {
    minimizer: [
      new OptimizeJsPlugin({ sourceMap: false }),
      new UglifyJsPlugin({
        sourceMap: true,
        uglifyOptions: {
          output: {
            comments: false,
          },
          dead_code: true,
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
    new WebpackClean([resolvePath('build')]),
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ],
})
