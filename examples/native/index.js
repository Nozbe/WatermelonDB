/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// The example passes WatermelonDB objects as navigation params, these objects contain functions which triggers this warning.
// See more: https://reactnavigation.org/docs/troubleshooting/#i-get-the-warning-non-serializable-values-were-found-in-the-navigation-state
LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

AppRegistry.registerComponent(appName, () => App);
