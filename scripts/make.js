#!/usr/bin/env node

const {
  pipe,
  filter,
  map,
  mapAsync,
  endsWith,
  both,
  prop,
  replace,
  omit,
  merge,
  forEach,
} = require('rambdax')

const babel = require('@babel/core')
const klaw = require('klaw-sync')
const mkdirp = require('mkdirp')
const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')
const prettyJson = require('json-stringify-pretty-compact')
const chokidar = require('chokidar')
const anymatch = require('anymatch')
const rimraf = require('rimraf')
const { execSync } = require('child_process')

const pkg = require('../package.json')

const resolvePath = (...paths) => path.resolve(__dirname, '..', ...paths)
const isDevelopment = process.env.NODE_ENV === 'development'

const SRC_MODULES = 'src'
const CJS_MODULES = 'cjs'

const SOURCE_PATH = resolvePath('src')
const DIST_PATH = resolvePath('dist')
const DEV_PATH = process.env.DEV_PATH || resolvePath('dev')

const DIR_PATH = isDevelopment ? DEV_PATH : DIST_PATH

const DO_NOT_BUILD_PATHS = [
  /__tests__/,
  /adapters\/__tests__/,
  /test\.(js|ts|tsx)$/,
  /integrationTest/,
  /__mocks__/,
  /\.DS_Store/,
  /package\.json/,
]

const isNotIncludedInBuildPaths = value => !anymatch(DO_NOT_BUILD_PATHS, value)

const cleanFolder = dir => rimraf.sync(dir)

const takeFiles = pipe(
  prop('path'),
  both(file => file.match(/\.(js|jsx|ts|tsx)$/), isNotIncludedInBuildPaths),
)

const takeModules = pipe(
  filter(takeFiles),
  map(prop('path')),
)

const removeSourcePath = replace(SOURCE_PATH, '')

const createModulePath = format => {
  const formatPathSegment = format === CJS_MODULES ? [] : [format]
  const modulePath = resolvePath(DIR_PATH, ...formatPathSegment)
  return replace(SOURCE_PATH, modulePath)
}

const createFolder = dir => mkdirp.sync(resolvePath(dir))

const getBabelConfig = file => {
  const isTypeScript = file.match(/\.(ts|tsx)$/)
  return {
    presets: [...(isTypeScript ? ['@babel/preset-typescript'] : []), '@babel/preset-env'],
    filename: file,
  }
}

const babelTransform = (format, file) => {
  if (format === SRC_MODULES) {
    // no transform, just return source
    return fs.readFileSync(file)
  }

  const { code } = babel.transformFileSync(file, getBabelConfig(file))
  return code
}

const compileTypeScript = () => {
  // Only run tsc if we have TypeScript files
  const hasTypeScriptFiles = glob.sync(`${SOURCE_PATH}/**/*.{ts,tsx}`).length > 0
  if (hasTypeScriptFiles) {
    try {
      execSync('tsc --emitDeclarationOnly', { stdio: 'inherit' })
    } catch (error) {
      console.error('TypeScript compilation failed:', error)
      process.exit(1)
    }
  }
}

const paths = klaw(SOURCE_PATH)
const modules = takeModules(paths)

const buildModule = format => file => {
  const modulePath = createModulePath(format)
  const code = babelTransform(format, file)
  const filename = modulePath(file).replace(/\.(ts|tsx)$/, '.js')

  createFolder(path.dirname(filename))
  fs.writeFileSync(filename, code)
}

const prepareJson = pipe(
  omit(['scripts']),
  merge({
    main: './index.js',
    types: './index.d.ts',
    sideEffects: false,
  }),
  obj => prettyJson(obj),
)

const createPackageJson = (dir, obj) => {
  const json = prepareJson(obj)
  fs.writeFileSync(resolvePath(dir, 'package.json'), json)
}

const copyFiles = (dir, files, rm = resolvePath()) =>
  forEach(file => {
    fs.copySync(file, path.join(dir, replace(rm, '', file)))
  }, files)

const copyNonJavaScriptFiles = buildPath => {
  createPackageJson(buildPath, pkg)
  copyFiles(buildPath, [
    'LICENSE',
    'README.md',
    'yarn.lock',
    'WatermelonDB.podspec',
    'docs',
    'native/shared',
    'native/ios',
    'native/android',
    'native/android-jsi',
  ])
  cleanFolder(`${buildPath}/native/android/build`)
  cleanFolder(`${buildPath}/native/android/bin/build`)
  cleanFolder(`${buildPath}/native/android-jsi/build`)
  cleanFolder(`${buildPath}/native/android-jsi/bin/build`)
}

cleanFolder(DIST_PATH)
createFolder(DIST_PATH)
copyNonJavaScriptFiles(DIST_PATH)

try {
  execSync('tsc --project tsconfig.json', { stdio: 'inherit' })
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('TypeScript compilation failed:', error)
  process.exit(1)
}
