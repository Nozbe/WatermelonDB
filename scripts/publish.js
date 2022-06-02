#!/usr/bin/env node
/* eslint-disable no-console */

// inspired by `np` – https://github.com/sindresorhus/np

const Listr = require('listr')
const listrInput = require('listr-input')
const execa = require('execa')
const timeout = require('p-timeout')
const inquirer = require('inquirer')
const semver = require('semver')

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

const throwError = str => info => {
  throw new Error(str, JSON.stringify(info))
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

  const isPrerelease = includes('-', version)
  const tag = isPrerelease ? 'next' : 'latest'

  // eslint-disable-next-line
  console.warn(`Will publish with NPM tag ${tag}`)

  return [
    // {
    //   title: 'ping npm registry',
    //   task: () =>
    //     timeout(
    //       execa('npm', ['ping']).catch(throwError('connection to npm registry failed')),
    //       5000,
    //       'Connection to npm registry timed out',
    //     ),
    // },
    ...(isPrerelease
      ? [
          {
            title: 'WARN: Skipping git checks',
            task: () => {},
          },
        ]
      : [
          /*          {
            title: 'check current branch',
            task: () =>
              execa('git', ['symbolic-ref', '--short', 'HEAD']).then(
                when(
                  ({ stdout: branch }) => branch !== 'master',
                  throwError('not on `master` branch'),
                ),
              ),
          },
          {
            title: 'check local working tree',
            task: () =>
              execa('git', ['status', '--porcelain']).then(
                when(
                  ({ stdout: status }) => status !== '',
                  throwError('commit or stash changes first'),
                ),
              ),
          },
          {
            title: 'check remote history',
            task: () =>
              execa('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']).then(
                when(
                  ({ stdout: result }) => result !== '0',
                  throwError('please pull changes first'),
                ),
              ),
          }, */
        ]),
    /* {
      title: 'check tests',
      task: () => execa('yarn', ['test']),
    }, */
    // {
    //   title: 'check flow',
    //   task: () => execa('yarn', ['flow']),
    // },
    // {
    //   title: 'check eslint',
    //   task: () => execa('yarn', ['eslint']),
    // },
    // TODO: Bring those back when metro config is fixed
    // {
    //   title: 'check iOS tests',
    //   task: () => execa('yarn', ['test:ios']),
    // },
    // {
    //   title: 'check Android tests',
    //   task: () => execa('yarn', ['test:android']),
    // },
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
      task: () => execa('yarn', ['pack'], { cwd: './dist' }),
    },
    {
      title: 'publish package',
      task: () =>
        execa('npm', ['publish', `./dist/BuildHero-watermelondb-v${version}.tgz`, '--tag', tag]),
      // {
      //   console.log('\u0007')
      //   return listrInput('2-Factor Authentication code', {
      //     validate: otp => otp.length > 0,
      //     done: otp =>
      //       execa('npm', [
      //         'publish',
      //         `./dist/nozbe-watermelondb-v${version}.tgz`,
      //         `--otp=${otp}`,
      //         '--tag',
      //         tag,
      //       ]),
      //   })
      // },
    },
    {
      title: 'git push',
      task: () => execa('git', ['push']),
    },
    {
      title: 'push tags',
      task: () => execa('git', ['push', '--tags', '--follow-tags']),
    },
    ...(isPrerelease
      ? []
      : [
          {
            title: 'update docs',
            task: () => execa('echo', ['IGNORED']), // execa('yarn', ['docs']),
          },
        ]),
  ]
}

inquirer.prompt(questions).then(options => {
  const tasks = buildTasks(options)
  const listr = new Listr(tasks)
  listr.run()
})
