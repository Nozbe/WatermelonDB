const Webpack = require('webpack')

const merge = require('webpack-merge')
const config = require('./webpack.common')

module.exports = merge(config, {
  mode: 'development',
  watch: true,
  devtool: 'source-map',
  plugins: [
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
})
