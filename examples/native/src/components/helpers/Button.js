import React from 'react'
import { Button as RNButton, View } from 'react-native'

import styles from './styles'

const Button = ({ title, onPress }) => (
  <View style={styles.button}>
    <RNButton title={title} onPress={onPress} />
  </View>
)

export default Button
