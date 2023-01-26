const babel = require('@babel/core')
const babelConfig = require('../babel.config')

const transform = ({ src, filename /* , options: { dev } */ }) => {
  // const nodeEnv = dev ? 'development' : 'production'
  const config = {
    filename,
    sourceFileName: filename,
    babelrc: false,
    ast: true,
    ...babelConfig.env.test,
  }

  const { ast, code, map } = babel.transform(src, config)

  return {
    ast,
    code,
    map,
    filename,
  }
}

module.exports = {
  transform,
}
