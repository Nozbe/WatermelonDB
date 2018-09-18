const Webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  target: 'web',
  resolve: {
    extensions: ['.js', '.json', '.css'],
    modules: ['./src', './node_modules'],
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    crypto: 'empty',
  },
  entry: ['./src/index.js'],
  output: {
    filename: '[name].[hash].js',
    chunkFilename: '[name].[hash].js',
    publicPath: '/',
    globalObject: 'this',
  },
  performance: {
    hints: false,
  },
  module: {
    rules: [
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
        },
      },
      {
        test: /(\.worker)?\.js$/,
        exclude: [/node_modules/],
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.(png|jpg|woff|woff2|ttf|eot|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              importLoaders: 1,
              localIdentName: '[path][name]__[local]___[hash:base64:5]',
              sourceMap: true,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              config: {
                path: './postcss.config.js',
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new Webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: true,
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[name].[hash].css',
    }),
    new HtmlWebpackPlugin({
      title: 'WatermelonDB Demo',
      template: './src/index.ejs',
    }),
  ],
}
