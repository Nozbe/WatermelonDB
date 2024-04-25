import React, { useState, Fragment } from 'react';
import { ScrollView, SafeAreaView, Alert, Text, View, Image, TextInput } from 'react-native';

import Button from './helpers/Button';
import styles from './helpers/styles';
import BlogList from './BlogList';

import { generate100, generate10k } from '../model/generate';
import { database } from '../../index';
import { Database } from '@nozbe/watermelondb';

import { RootProps } from '../types'

function Root({ navigation }: RootProps) {

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const generateWith = async (generator: (database: Database) => Promise<number>) => {
    setIsGenerating(true);

    const count = await generator(database);
    Alert.alert(`Generated ${count} records!`);

    setIsGenerating(false);
  };

  const runGenerate100 = () => generateWith(generate100);

  const runGenerate10k = () => generateWith(generate10k);

  const deleteAll = async () => {
    setIsDeleting(true)

    await database.write(async () => {
      await database.unsafeResetDatabase();
    })

    setIsDeleting(false)
  }
  
  const handleTextChanges = (v: string) => setSearch(v);

  const handleOnFocus = () => setIsSearchFocused(true);

  const handleOnBlur = () => setIsSearchFocused(false);

  return (
    <SafeAreaView>
      <ScrollView>
        {!isSearchFocused && (
          <Fragment>
            <Image style={styles.logo} source={require('./assets/logo-app.png')} />
            <View style={styles.marginContainer}>
              <Text style={styles.header}>Generate:</Text>
              <View style={styles.buttonContainer}>
                <Button title="100 records" onPress={runGenerate100} />
                <Button title="10,000 records" onPress={runGenerate10k} />
              </View>
              <View style={styles.buttonContainer}>
                <Button title="delete all records" onPress={deleteAll} />
              </View>
            </View>
          </Fragment>
        )}
        <TextInput
          style={{ padding: 5, fontSize: 16 }}
          placeholder="Search ..."
          defaultValue=""
          onFocus={handleOnFocus}
          onBlur={handleOnBlur}
          onChangeText={handleTextChanges}
        />
        {!(isGenerating || isDeleting) && (
          <BlogList database={database} search={search} navigation={navigation} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Root;
