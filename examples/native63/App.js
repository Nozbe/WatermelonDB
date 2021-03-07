import React from 'react';
import 'react-native-gesture-handler';
import {NativeModules, Text, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import Root from './src/components/Root';
import Blog from './src/components/Blog';
import Post from './src/components/Post';
import ModerationQueue from './src/components/ModerationQueue';

function HomeScreen() {
  const appStartedLaunchingAt =
    NativeModules.PerformancePlugin.appInitTimestamp;
  const [timeToLaunch] = React.useState(
    new Date().getTime() - appStartedLaunchingAt,
  );
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text>Time to launch: {timeToLaunch}</Text>
    </View>
  );
}

const Stack = createStackNavigator();

const App = () => {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Root" component={Root} />
          <Stack.Screen name="Blog" component={Blog} />
          <Stack.Screen name="Post" component={Post} />
          <Stack.Screen name="ModerationQueue" component={ModerationQueue} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;
