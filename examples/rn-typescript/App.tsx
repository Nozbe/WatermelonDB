import React from 'react';
import 'react-native-gesture-handler';
// import { NativeModules } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/types';
import Root from './src/components/Root';
import Blog from './src/components/Blog';
import Post from './src/components/Post';
import ModerationQueue from './src/components/ModerationQueue';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  // const appStartedLaunchingAt = NativeModules.PerformancePlugin.appInitTimestamp;
  // const [timeToLaunch] = React.useState(new Date().getTime() - appStartedLaunchingAt);

  return (
    <NavigationContainer>
      <RootStack.Navigator initialRouteName='Root'>
        <RootStack.Screen name="Root" component={Root} />
        <RootStack.Screen name="Blog" component={Blog} />
        <RootStack.Screen name="Post" component={Post} />
        <RootStack.Screen name="ModerationQueue" component={ModerationQueue} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default App;
