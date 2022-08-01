#!/usr/bin/env node

// inspired by `np` – https://github.com/sindresorhus/np

const Listr = require('listr')
const inquirer = require('inquirer')

const { execSync } = require('child_process')

const launchFirst = process.argv[2]
const noSnapshot = process.argv[3]

const emulators = execSync(`$ANDROID_HOME/emulator/emulator -list-avds`).toString()
const sdks = execSync(
  `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list | grep "system-images/" `,
).toString()

const askForEmu = [
  {
    type: 'list',
    name: 'name',
    message: 'Pick Emulator from list or add a new one',
    pageSize: emulators.length + 4,
    choices: emulators
      .split('\n')
      .filter(value => value.length > 0)
      .map(emu => ({
        name: emu,
        value: emu,
      }))
      .concat([
        new inquirer.Separator(),
        {
          name: 'New Emulator',
          value: null,
        },
        new inquirer.Separator(),
      ]),
  },
  {
    type: 'list',
    name: 'sdk',
    when: answers => !answers.name,
    message: 'Sdk Version:',
    pageSize: sdks.length + 4,
    choices: sdks
      .split('\n')
      .filter(value => value.length > 0)
      .map(sdk => ({
        name: sdk.split(' ')[2].slice(14),
        value: sdk.split(' ')[2],
      }))
      .concat([
        new inquirer.Separator(),
        {
          name: 'Other Sdk (Require download)',
          value: null,
        },
        new inquirer.Separator(),
      ]),
  },
  {
    type: 'input',
    name: 'sdk',
    when: answers => !answers.sdk && !answers.name,
    message: 'Sdk Version (21-28):',
    validate: input => input > 20 && input < 29,
  },
  {
    type: 'input',
    name: 'name',
    when: answers => !answers.name,
    message: 'Name:',
  },
]

const emulatorTasks = options => {
  const { name, sdk } = options
  const tasks = []
  if (sdk !== undefined) {
    const sdkPath =
      sdk.length === 2 ? `system-images;android-${sdk.replace(/\s/g, '')};google_apis;x86` : sdk
    if (sdk.length === 2) {
      tasks.push({
        title: 'Downloading Emulator Image',
        task: () => {
          // eslint-disable-next-line
          console.log('Downloading Emulator Image\nIt may take a while')
          execSync('touch ~/.android/repositories.cfg')
          execSync(`$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "${sdkPath}"`)
        },
      })
    }
    tasks.push({
      title: `Creating Emulator ${name}`,
      task: () => {
        execSync(
          `echo no | $ANDROID_HOME/tools/bin/avdmanager \
             create avd -n ${name.replace(/\s/g, '')} -k "${sdkPath}" --device "Nexus 6P"`,
        )
      },
    })
  }
  tasks.push({
    title: 'Open Emulator',
    task: () => execSync(`$ANDROID_HOME/emulator/emulator @${name}`),
  })
  return tasks
}

if (launchFirst) {
  execSync(
    `$ANDROID_HOME/emulator/emulator @${emulators.split('\n')[0]} ${
      noSnapshot ? '-no-snapshot' : ''
    }`,
  )
} else {
  inquirer.prompt(askForEmu).then(options => {
    const tasks = emulatorTasks(options)
    const listr = new Listr(tasks)
    listr.run()
  })
}
