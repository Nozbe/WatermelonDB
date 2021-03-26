import React from 'react';
import 'react-native-gesture-handler';
import {NativeModules} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import Root from './src/components/Root';
import Blog from './src/components/Blog';
import Post from './src/components/Post';
import ModerationQueue from './src/components/ModerationQueue';

const Stack = createStackNavigator();

const App = () => {
  const appStartedLaunchingAt =
    NativeModules.PerformancePlugin.appInitTimestamp;
  const [timeToLaunch] = React.useState(
    new Date().getTime() - appStartedLaunchingAt,
  );

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Root"
          component={Root}
          initialParams={{timeToLaunch}}
        />
        <Stack.Screen name="Blog" component={Blog} />
        <Stack.Screen name="Post" component={Post} />
        <Stack.Screen name="ModerationQueue" component={ModerationQueue} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
