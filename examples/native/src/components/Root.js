import React, { Component, Fragment } from 'react'
import { SafeAreaView, Alert, Text, View, Image, TextInput } from 'react-native'
import { ScrollView } from 'react-navigation'

import { generate100, generate10k } from '../models/generate'
import Button from './helpers/Button'
import styles from './helpers/styles'
import BlogList from './BlogList'

import logoSrc from './assets/logo-app.png'

class Root extends Component {
  state = {
    isGenerating: false,
    search: '',
    isSearchFocused: false,
  }

  generateWith = async generator => {
    this.setState({ isGenerating: true })

    const count = await generator(this.props.database)
    Alert.alert(`Generated ${count} records!`)

    this.setState({ isGenerating: false })
  }

  generate100 = () => this.generateWith(generate100)

  generate10k = () => this.generateWith(generate10k)

  handleTextChanges = v => this.setState({ search: v })

  handleOnFocus = () => this.setState({ isSearchFocused: true })

  handleOnBlur = () => this.setState({ isSearchFocused: false })

  render() {
    const { search, isGenerating, isSearchFocused } = this.state
    const { database, navigation, timeToLaunch } = this.props

    return (
      <ScrollView>
        <SafeAreaView>
          {!isSearchFocused && (
            <Fragment>
              <Image style={styles.logo} source={logoSrc} />
              <Text style={styles.post}>Launch time: {timeToLaunch} ms</Text>
              <View style={styles.marginContainer}>
                <Text style={styles.header}>Generate:</Text>
                <View style={styles.buttonContainer}>
                  <Button title="100 records" onPress={this.generate100} />
                  <Button title="10,000 records" onPress={this.generate10k} />
                </View>
              </View>
            </Fragment>
          )}
          <TextInput style={{ padding: 5, fontSize: 16 }}
            placeholder="Search ..."
            defaultValue=""
            onFocus={this.handleOnFocus}
            onBlur={this.handleOnBlur}
            onChangeText={this.handleTextChanges} />
          {!isGenerating && (
            <BlogList database={database} search={search} navigation={navigation} />
          )}
        </SafeAreaView>
      </ScrollView>
    )
  }
}

export default Root
