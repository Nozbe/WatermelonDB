#!/usr/bin/env node

// inspired by `np` – https://github.com/sindresorhus/np

const Listr = require('listr')
const execa = require('execa')
const timeout = require('p-timeout')
const inquirer = require('inquirer')
const semver = require('semver')
const fs = require('fs-extra')

const { when, includes, flip, both, add } = require('rambdax')

const pkg = require('../package.json')

const flippedIncludes = flip(includes)
const increments = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']
// const prerelease = ['prepatch', 'preminor', 'premajor', 'prerelease']

const belongsToIncrements = flippedIncludes(increments)
const isValidVersion = input => Boolean(semver.valid(input))
const isVersionGreater = input => semver.gt(input, pkg.version)
const getNewVersion = input => semver.inc(pkg.version, input)
const isValidAndGreaterVersion = both(isValidVersion, isVersionGreater)

const throwError = () => str => {
  throw new Error(str)
}

const questions = [
  {
    type: 'list',
    name: 'version',
    message: `Specify new version (current version: ${pkg.version}):`,
    pageSize: add(increments.length, 4),
    choices: increments
      .map(inc => ({
        name: `${inc} 	${semver.inc(pkg.version, inc)}`,
        value: inc,
      }))
      .concat([
        new inquirer.Separator(),
        {
          name: 'Other (specify)',
          value: null,
        },
      ]),
    filter: input => (belongsToIncrements(input) ? getNewVersion(input) : input),
  },
  {
    type: 'input',
    name: 'version',
    message: 'Version:',
    when: answers => !answers.version,
    validate: input => isValidAndGreaterVersion(input),
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
      title: 'check eslint',
      task: () => execa('yarn', ['test']),
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
      title: 'build package',
      task: () => execa('yarn', ['build']),
    },
    {
      title: 'pack tgz',
      task: () =>
        execa('yarn', ['pack'], { cwd: './dist' })
          .then(() => fs.remove(`./nozbe-watermelondb-v${version}.tgz`))
          .then(() => {
            fs.move(
              `./dist/nozbe-watermelondb-v${version}.tgz`,
              `./nozbe-watermelondb-v${version}.tgz`,
            )
          }),
    },
    {
      title: 'publish package',
      task: () =>
        execa('yarn', [
          'publish',
          `./nozbe-watermelondb-v${version}.tgz`,
          '--new-version',
          version,
        ]),
    },
    {
      title: 'push tags',
      task: () => execa('git', ['push', '--follow-tags']),
    },
    {
      title: 'cleanup',
      task: () => fs.remove(`./nozbe-watermelondb-v${version}.tgz`),
    },
  ]
}

inquirer.prompt(questions).then(options => {
  const tasks = buildTasks(options)
  const listr = new Listr(tasks)
  listr.run()
})
