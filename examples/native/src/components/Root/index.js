import React from 'react'
import { Platform, Text, View } from 'react-native'

import style from './style'

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
  android: 'Double tap R on your keyboard to reload,\n' + 'Shake or press menu button for dev menu',
})

const App = _props => (
  <View style={style.container}>
    <Text style={style.welcome}>Welcome to React Native!</Text>
    <Text style={style.instructions}>To get started, edit App.js</Text>
    <Text style={style.instructions}>{instructions}</Text>
  </View>
)

export default App
