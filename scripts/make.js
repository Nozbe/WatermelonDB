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
  debounce,
} = require('rambdax')

const babel = require('@babel/core')
const klaw = require('klaw-sync')
const mkdirp = require('mkdirp')
const path = require('path')
const fs = require('fs-extra')
const prettyJson = require('json-stringify-pretty-compact')
const chokidar = require('chokidar')
const anymatch = require('anymatch')
const rimraf = require('rimraf')
const { execFile } = require('child_process')

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
  /test\.js/,
  /integrationTest/,
  /__mocks__/,
  /\.DS_Store/,
  /package\.json/,
  /___jb_tmp___$/,
]

const ONLY_WATCH_PATHS = [/\.ts$/]

const isNotIncludedInBuildPaths = value =>
  !anymatch([...DO_NOT_BUILD_PATHS, ...ONLY_WATCH_PATHS], value)

const cleanFolder = dir => rimraf.sync(dir)

const takeFiles = pipe(
  prop('path'),
  both(endsWith('.js'), isNotIncludedInBuildPaths),
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

const babelTransform = (format, file) => {
  if (format === SRC_MODULES) {
    // no transform, just return source
    return fs.readFileSync(file)
  }

  const { code } = babel.transformFileSync(file, {})
  return code
}

const paths = klaw(SOURCE_PATH)
const modules = takeModules(paths)

const buildModule = format => file => {
  const modulePath = createModulePath(format)
  const code = babelTransform(format, file)
  const filename = modulePath(file)

  createFolder(path.dirname(filename))
  fs.writeFileSync(filename, code)
}

const prepareJson = pipe(
  omit(['scripts']),
  merge({
    main: './index.js',
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
    'docs',
    'native/ios',
    'native/android',
    'babel',
  ])
  cleanFolder(`${buildPath}/native/android/build`)
}

const isTypescript = file => file.match(/\.ts$/)

const compileTypescriptDefinitions = () => {
  // eslint-disable-next-line
  console.log(`✓ TypeScript definitions`)

  execFile(
    './node_modules/.bin/dts-generator',
    // eslint-disable-next-line
    ['--project', '.', '--out', path.resolve(DIST_PATH, 'index.d.ts')],
    (error, stdout) => {
      // eslint-disable-next-line
      console.log(stdout)
    },
  )
}

if (isDevelopment) {
  const buildCjsModule = buildModule(CJS_MODULES)
  const buildSrcModule = buildModule(SRC_MODULES)

  const buildFile = file => {
    buildSrcModule(file)
    buildCjsModule(file)
  }

  const compileTypescriptDefinitionsWhenIdle = debounce(compileTypescriptDefinitions, 250)

  const processFile = file => {
    if (isTypescript(file)) {
      compileTypescriptDefinitionsWhenIdle()
    } else {
      // eslint-disable-next-line
      console.log(`✓ ${removeSourcePath(file)}`)
      buildFile(file)
    }
  }

  cleanFolder(DEV_PATH)
  createFolder(DEV_PATH)
  copyNonJavaScriptFiles(DEV_PATH)

  chokidar
    .watch(resolvePath('src'), { ignored: DO_NOT_BUILD_PATHS })
    .on('all', (event, fileOrDir) => {
      // eslint-disable-next-line
      switch (event) {
        case 'add':
        case 'change':
          processFile(fileOrDir)
          break
        default:
          break
      }
    })
} else {
  const buildModules = format => mapAsync(buildModule(format))
  const buildCjsModules = buildModules(CJS_MODULES)
  const buildSrcModules = buildModules(SRC_MODULES)

  cleanFolder(DIST_PATH)
  createFolder(DIST_PATH)
  copyNonJavaScriptFiles(DIST_PATH)

  buildSrcModules(modules)
  buildCjsModules(modules)
  compileTypescriptDefinitions()
}
