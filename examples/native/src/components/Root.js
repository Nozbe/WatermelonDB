import React, { Component } from 'react'
import { ScrollView, SafeAreaView, Alert, Text } from 'react-native'

import { generate100, generate10k } from '../models/generate'
import Button from './helpers/Button'
import styles from './helpers/styles'
import BlogList from './BlogList'

class Root extends Component {
  state = { isGenerating: false }

  generateWith = async generator => {
    this.setState({ isGenerating: true })

    const count = await generator(this.props.database)
    Alert.alert(`Generated ${count} records!`)

    this.setState({ isGenerating: false })
  }

  generate100 = () => this.generateWith(generate100)

  generate10k = () => this.generateWith(generate10k)

  render() {
    return (
      <ScrollView>
        <SafeAreaView>
          <Text style={styles.post}>Launch time: {this.props.timeToLaunch} ms</Text>
          <Button title="Generate 100 records" onPress={this.generate100} />
          <Button title="Generate 10,000 records" onPress={this.generate10k} />
          {!this.state.isGenerating && (
            <BlogList database={this.props.database} navigation={this.props.navigation} />
          )}
        </SafeAreaView>
      </ScrollView>
    )
  }
}

export default Root
