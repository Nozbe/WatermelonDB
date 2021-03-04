/**
 * @format
 */

import { AppRegistry, NativeModules } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

const appStartedLaunchingAt = NativeModules.PerformancePlugin.appInitTimestamp
const timeToLaunch = new Date().getTime() - appStartedLaunchingAt

console.log({appStartedLaunchingAt})
console.log({timeToLaunch})

AppRegistry.registerComponent(appName, () => App);
