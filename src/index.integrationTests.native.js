// @flow
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/first */

process.env.NODE_ENV = 'test'

import React from 'react'
import { AppRegistry, Text } from 'react-native'
import Tester from 'cavy/src/Tester'
import TestHookStore from 'cavy/src/TestHookStore'
import CavyNativeReporter from 'cavy-native-reporter'
import integrationTests from './__tests__/integrationTests'

// Mysteriously fixes React Native stacktrace symbolication ¯\_(ツ)_/¯
if (typeof global.self === 'undefined') {
  global.self = global
}

const testHookStore = new TestHookStore()
const TestRoot = () => (
  <Tester specs={integrationTests}
    store={testHookStore}
    waitTime={4000}
    sendReport={true}
    reporter={CavyNativeReporter.reporter}>
    <Text style={{ paddingTop: 100 }}>The tests are running. Please remain calm.</Text>
  </Tester>
)
AppRegistry.registerComponent('watermelonTest', () => TestRoot)
