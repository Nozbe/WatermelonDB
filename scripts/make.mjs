#!/usr/bin/env node

import {
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
} from 'rambdax'

import babel from '@babel/core'
import klaw from 'klaw-sync'
import mkdirp from 'mkdirp'
import path from 'path'
import fs from 'fs-extra'
import glob from 'glob'
import { fileURLToPath } from 'url'
import prettyJson from 'json-stringify-pretty-compact'
import chokidar from 'chokidar'
import anymatch from 'anymatch'
import rimraf from 'rimraf'

import pkg from './pkg.cjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  /__typetests__/,
  /__playground__/,
  /test\.js/,
  /integrationTest/,
  /__mocks__/,
  /\.DS_Store/,
  /package\.json/,
]

const isNotIncludedInBuildPaths = (value) => !anymatch(DO_NOT_BUILD_PATHS, value)

const cleanFolder = (dir) => rimraf.sync(dir)

const takeFiles = pipe(prop('path'), both(endsWith('.js'), isNotIncludedInBuildPaths))

const takeModules = pipe(filter(takeFiles), map(prop('path')))

const removeSourcePath = replace(SOURCE_PATH, '')

const createModulePath = (format) => {
  const formatPathSegment = format === CJS_MODULES ? [] : [format]
  const modulePath = resolvePath(DIR_PATH, ...formatPathSegment)
  return replace(SOURCE_PATH, modulePath)
}

const createFolder = (dir) => mkdirp.sync(resolvePath(dir))

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

const buildModule = (format) => (file) => {
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
    types: 'index.d.ts',
  }),
  (obj) => prettyJson(obj),
)

const createPackageJson = (dir, obj) => {
  const json = prepareJson(obj)
  fs.writeFileSync(resolvePath(dir, 'package.json'), json)
}

const copyFiles = (dir, files, rm = resolvePath()) =>
  forEach((file) => {
    fs.copySync(file, path.join(dir, replace(rm, '', file)))
  }, files)

const copyNonJavaScriptFiles = (buildPath) => {
  createPackageJson(buildPath, pkg)
  copyFiles(buildPath, [
    'LICENSE',
    // 'README.md',
    'yarn.lock',
    'WatermelonDB.podspec',
    'react-native.config.js', // NOTE: this is needed for autolinking
    // 'docs',
    'native/shared',
    'native/ios',
    'native/android',
    'native/android-jsi',
  ])
  cleanFolder(`${buildPath}/native/ios/WatermelonDB.xcodeproj/xcuserdata`)
  cleanFolder(`${buildPath}/native/android/build`)
  cleanFolder(`${buildPath}/native/android/bin/build`)
  cleanFolder(`${buildPath}/native/android-jsi/.cxx`)
  cleanFolder(`${buildPath}/native/android-jsi/.externalNativeBuild`)
  cleanFolder(`${buildPath}/native/android-jsi/build`)
  cleanFolder(`${buildPath}/native/android-jsi/bin/build`)
}

if (isDevelopment) {
  const buildCjsModule = buildModule(CJS_MODULES)
  const buildSrcModule = buildModule(SRC_MODULES)

  const buildFile = (file) => {
    if (file.match(/\.js$/)) {
      buildSrcModule(file)
      buildCjsModule(file)
    } else if (file.match(/\.d.ts$/)) {
      // Typescript
      fs.copySync(file, path.join(DEV_PATH, replace(SOURCE_PATH, '', file)))
    } else {
      // native files
      fs.copySync(file, path.join(DEV_PATH, replace(resolvePath(), '', file)))
    }
  }

  cleanFolder(DEV_PATH)
  createFolder(DEV_PATH)
  copyNonJavaScriptFiles(DEV_PATH)

  chokidar
    .watch(
      [
        resolvePath('src'),
        resolvePath('native/ios/WatermelonDB'),
        resolvePath('native/shared'),
        resolvePath('native/android/src/main'),
        resolvePath('native/android-jsi/src/main'),
      ],
      {
        ignored: DO_NOT_BUILD_PATHS,
      },
    )
    .on('all', (event, fileOrDir) => {
      // eslint-disable-next-line
      switch (event) {
        case 'add':
        case 'change':
          // eslint-disable-next-line
          console.log(`✓ ${removeSourcePath(fileOrDir)}`)
          buildFile(fileOrDir)
          break
        default:
          break
      }
    })
} else {
  const buildModules = (format) => mapAsync(buildModule(format))
  const buildCjsModules = buildModules(CJS_MODULES)
  const buildSrcModules = buildModules(SRC_MODULES)

  cleanFolder(DIST_PATH)
  createFolder(DIST_PATH)
  copyNonJavaScriptFiles(DIST_PATH)

  buildSrcModules(modules)
  buildCjsModules(modules)

  // copy typescript definitions
  glob(`${SOURCE_PATH}/**/*.d.ts`, {}, (err, files) => {
    files.forEach((file) => {
      fs.copySync(file, path.join(DIST_PATH, replace(SOURCE_PATH, '', file)))
    })
  })
}
