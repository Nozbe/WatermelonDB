#!/usr/bin/env node

const {
  pipe,
  filter,
  map,
  mapAsync,
  endsWith,
  both,
  includes,
  prop,
  all,
  replace,
  join,
  reduce,
  omit,
  merge,
  forEach,
} = require('rambdax')

const rollup = require('rollup')
const klaw = require('klaw-sync')
const mkdirp = require('mkdirp')
const path = require('path')
const fs = require('fs-extra')
const prettyJson = require('json-stringify-pretty-compact')

const pkg = require('../package.json')
const rollupConfig = require('./rollup.config')

const resolvePath = (...paths) => path.resolve(__dirname, '..', ...paths)

const ESM_MODULES = 'esm'
const CJS_MODULES = 'cjs'

const SOURCE_PATH = resolvePath('src')
const DIST_PATH = resolvePath('dist')
const DO_NOT_BUILD_PATHS = [
  'adapters/__tests__',
  'test.js',
  'type.js',
  'integrationTest.js',
  '__mocks__',
  'Collection/RecordCache.js',
]

const createModulePath = format => {
  const modulePath = resolvePath(DIST_PATH, format)
  return replace(SOURCE_PATH, modulePath)
}

const isNotIncludedInBuildPaths = value =>
  all(buildPath => !includes(buildPath, value), DO_NOT_BUILD_PATHS)

const takeFiles = pipe(
  prop('path'),
  both(endsWith('.js'), isNotIncludedInBuildPaths),
)

const takeModules = pipe(
  filter(takeFiles),
  map(prop('path')),
)

const removeSourcePath = replace(SOURCE_PATH, '')

const toStringKeyValue = module => `'${module.key}': '${module.value}'`
const indentLine = line => `    ${line},`
const toStringObject = pipe(
  map(
    pipe(
      toStringKeyValue,
      indentLine,
    ),
  ),
  join('\n'),
)

const pathMappingTemplate = obj =>
  `
"use strict"

module.exports = function() {
  return {
${toStringObject(obj)}
  }
}
  `

const createPathName = file => {
  const value = removeSourcePath(file)
  return endsWith('index.js', value) ? path.dirname(value) : replace('.js', '', value)
}

const createModuleName = name => `${pkg.name}${name}`

const buildPathMapping = format =>
  pipe(
    map(file => {
      const name = createPathName(file)

      return {
        key: createModuleName(name),
        value: `${pkg.name}/dist/${format}${name}`,
      }
    }),
    pathMappingTemplate,
    content => {
      try {
        mkdirp.sync(resolvePath(DIST_PATH, format))
        fs.writeFileSync(resolvePath(DIST_PATH, format, 'path-mapping.js'), content)
      } catch (err) {
        // eslint-disable-next-line
        console.error(err)
      }
    },
  )

const paths = klaw(SOURCE_PATH)
const modules = takeModules(paths)
const createExternals = pipe(
  filter(takeFiles),
  reduce((acc, file) => {
    const name = createPathName(file.path)
    return [...acc, createModuleName(name)]
  }, []),
)
const externals = createExternals(paths)

const buildCjsPathMapping = buildPathMapping(CJS_MODULES)
const buildEsmPathMapping = buildPathMapping(ESM_MODULES)

const buildModule = format => async file => {
  const modulePath = createModulePath(format)
  const inputOptions = {
    ...rollupConfig,
    external: [...rollupConfig.external, ...externals],
    input: file,
  }
  const outputOptions = {
    format,
    file: modulePath(file),
    exports: 'named',
  }

  const bundle = await rollup.rollup(inputOptions)

  await bundle.write(outputOptions)
}

const prepareJson = pipe(
  omit(['scripts']),
  merge({
    main: './cjs/index.js',
    module: './esm/index.js',
    sideEffects: false,
  }),
  obj => prettyJson(obj),
)

const createDistFolder = () => mkdirp.sync(resolvePath(DIST_PATH))

const createPackageJson = obj => {
  const json = prepareJson(obj)
  fs.writeFileSync(resolvePath(DIST_PATH, 'package.json'), json)
}

const copyFilesToDistFolder = forEach(file =>
  fs.copySync(resolvePath(file), resolvePath(DIST_PATH, file)),
)

const buildModules = format => mapAsync(buildModule(format))
const buildCjsModules = buildModules(CJS_MODULES)
const buildEsmModules = buildModules(ESM_MODULES)

createDistFolder()
createPackageJson(pkg)
copyFilesToDistFolder(['LICENSE', 'README.md', 'yarn.lock', 'docs', 'src'])
buildCjsPathMapping(modules)
buildEsmPathMapping(modules)
buildEsmModules(modules)
buildCjsModules(modules)
