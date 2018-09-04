module.exports = {
  plugins: {
    'postcss-url': {},
    'postcss-preset-env': {
      // https://github.com/csstools/postcss-preset-env/blob/master/lib/ids-by-execution-order.js
      features: {
        'nesting-rules': true,
      },
    },
    'postcss-calc': {},
    'postcss-hexrgba': {},
    'postcss-browser-reporter': {},
    'postcss-reporter': {},
  },
}
