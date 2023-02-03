#!/usr/bin/env node
/* eslint-disable no-console */

// inspired by `np` – https://github.com/sindresorhus/np

import Listr from 'listr'
import listrInput from 'listr-input'
import { execa } from 'execa'
import inquirer from 'inquirer'
import semver from 'semver'

import pkg from './pkg.cjs'

const increments = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']

const getNewVersion = (input) => semver.inc(pkg.version, input)
const isValidAndGreaterVersion = (input) =>
  Boolean(semver.valid(input)) && semver.gt(input, pkg.version)

const throwError = (str) => (info) => {
  throw new Error(str, JSON.stringify(info))
}

const promiseTimeoutError = (errorMessage, ms) =>
  new Promise((_, reject) => {
    setTimeout(reject, ms, new Error(errorMessage))
  })

const skipChecks = process.argv.includes('--skip-checks')

const questions = [
  {
    type: 'list',
    name: 'version',
    message: `Specify new version (current version: ${pkg.version}):`,
    pageSize: 10,
    choices: increments
      .map((inc) => ({
        name: `${inc} 	${semver.inc(pkg.version, inc)}`,
        value: inc,
      }))
      .concat([
        new inquirer.Separator(),
        {
          name: 'Other (specify)',
          value: undefined,
        },
      ]),
    filter: (input) => (increments.includes(input) ? getNewVersion(input) : input),
  },
  {
    type: 'input',
    name: 'version',
    message: 'Version:',
    when: (answers) => !answers.version,
    validate: (input) => isValidAndGreaterVersion(input),
  },
]

const buildTasks = (options) => {
  const { version } = options

  const isPrerelease = version.includes('-')
  const tag = isPrerelease ? 'next' : 'latest'

  // eslint-disable-next-line
  console.warn(`Will publish with NPM tag ${tag}`)

  return [
    {
      title: 'ping npm registry',
      task: () =>
        Promise.race([
          execa('npm', ['ping']).catch(throwError('connection to npm registry failed')),
          promiseTimeoutError('Connection to npm registry timed out', 5000),
        ]),
    },
    ...(isPrerelease
      ? [
          {
            title: 'WARN: Skipping git checks',
            task: () => {},
          },
        ]
      : [
          {
            title: 'check current branch',
            task: () =>
              execa('git', ['symbolic-ref', '--short', 'HEAD']).then((info) => {
                if (!(info.stdout === 'master' || info.stdout.startsWith('release/'))) {
                  throwError('releases should be made from `master` or `release/xxx` branch')(info)
                }
              }),
          },
          {
            title: 'check local working tree',
            task: () =>
              execa('git', ['status', '--porcelain']).then((info) => {
                if (info.stdout !== '') {
                  throwError('commit or stash changes first')(info)
                }
              }),
          },
          {
            title: 'check remote history',
            task: () =>
              execa('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']).then((info) => {
                if (info.stdout !== '0') {
                  throwError('please pull changes first')(info)
                }
              }),
          },
        ]),
    ...(!skipChecks
      ? [
          {
            title: 'check tests',
            task: () => execa('yarn', ['test']),
          },
          {
            title: 'check flow',
            task: () => execa('yarn', ['flow']),
          },
          {
            title: 'check eslint',
            task: () => execa('yarn', ['eslint']),
          },
        ]
      : [
          {
            title: 'WARN: Skipping test/flow/lint checks',
            task: () => {},
          },
        ]),
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
      task: () => {
        console.log('\u0007')
        return listrInput('2-Factor Authentication code', {
          validate: (otp) => otp.match(/\d{6}/),
          done: (otp) =>
            execa('npm', [
              'publish',
              `./dist/nozbe-watermelondb-v${version}.tgz`,
              `--otp=${otp}`,
              '--tag',
              tag,
            ]),
        })
      },
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
            title: 'update docs version',
            task: () => execa('yarn', ['docs:version', version]),
          },
          {
            title: 'update docs',
            task: () => execa('yarn', ['docs']),
          },
        ]),
  ]
}

inquirer.prompt(questions).then((options) => {
  const tasks = buildTasks(options)
  const listr = new Listr(tasks)
  listr.run()
})
