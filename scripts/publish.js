#!/usr/bin/env node

// inspired by `np` – https://github.com/sindresorhus/np

const Listr = require('listr')
const execa = require('execa')
const timeout = require('p-timeout')
const inquirer = require('inquirer')
const semver = require('semver')

const { when } = require('rambdax')

const pkg = require('../package.json')

const throwError = () => str => {
  throw new Error(str)
}

const questions = [
  {
    type: 'input',
    name: 'version',
    message: `Specify new version (current version: ${pkg.version}):`,
    validate: input => {
      const isValidVersion = semver.valid(input)
      const isGreaterThanCurrentVersion = semver.gt(input, pkg.version)

      return isValidVersion && isGreaterThanCurrentVersion
    },
  },
]

const buildTasks = options => {
  const { version } = options

  return [
    {
      title: 'ping npm registry',
      task: () =>
        timeout(
          execa.stdout('npm', ['ping']).catch(throwError('connection to npm registry failed')),
          5000,
          'Connection to npm registry timed out',
        ),
    },
    {
      title: 'check current branch',
      task: () =>
        execa
          .stdout('git', ['symbolic-ref', '--short', 'HEAD'])
          .then(when(branch => branch !== 'master', throwError('not on `master` branch'))),
    },
    {
      title: 'check local working tree',
      task: () =>
        execa
          .stdout('git', ['status', '--porcelain'])
          .then(when(status => status !== '', throwError('commit or stash changes first'))),
    },
    {
      title: 'check remote history',
      task: () =>
        execa
          .stdout('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD'])
          .then(when(result => result !== '0', throwError('please pull changes first'))),
    },
    {
      title: 'check flow',
      task: () => execa('yarn', ['flow']),
    },
    {
      title: 'run tests',
      task: () => execa('yarn', ['test']),
    },
    {
      title: 'bump version',
      task: () => execa('yarn', ['version', '--new-version', version]),
    },
    {
      title: 'remove `node_modules`',
      task: () => execa('rm', ['-rf', 'node_modules']),
    },
    {
      title: 'install dependencies',
      task: () => execa('yarn', ['install', '--frozen-lockfile', '--production=false']),
    },
    {
      title: 'build package',
      task: () => execa('yarn', ['build']),
    },
    {
      title: 'publish package',
      task: () =>
        execa('cd', ['./dist']).then(() => execa('yarn', ['publish', '--new-version', version])),
    },
  ]
}

inquirer.prompt(questions).then(options => {
  const tasks = buildTasks(options)
  const listr = new Listr(tasks)
  listr.run()
})
