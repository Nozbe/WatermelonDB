/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/first */

process.env.NODE_ENV = 'test'
import React from 'react'
import { AppRegistry, Text, NativeModules } from 'react-native'

// Mysteriously fixes React Native stacktrace symbolication ¯\_(ツ)_/¯
if (typeof global.self === 'undefined') {
  global.self = global
}

// NOTE: Set to `true` to run src/__playground__/index.js
// WARN: DO NOT commit this change!
const openPlayground = false

if (openPlayground) {
  const PlaygroundPlaceholder = () => <Text style={{ paddingTop: 100 }}>Playground is running</Text>
  AppRegistry.registerComponent('watermelonTest', () => PlaygroundPlaceholder)
  require('./__playground__')
} else {
  const TestRoot = () => {
    require('./__tests__/setUpIntegrationTestEnv')

    const Tester = require('cavy/src/Tester').default
    const TestHookStore = require('cavy/src/TestHookStore').default
    const integrationTests = require('./__tests__/integrationTests').default

    const { current: testHookStore } = React.useRef(new TestHookStore())
    const sendReport = report => {
      // eslint-disable-next-line
      console.log('Done:')
      // eslint-disable-next-line
      console.log(report)
      NativeModules.BridgeTestReporter.testsFinished(report)
    }

    return (
      <Tester specs={integrationTests}
        store={testHookStore}
        waitTime={4000}
        sendReport={true}
        customReporter={sendReport}>
        <Text style={{ paddingTop: 100 }}>The tests are running. Please remain calm.</Text>
      </Tester>
    )
  }
  AppRegistry.registerComponent('watermelonTest', () => TestRoot)
}
