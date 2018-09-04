import { AppRegistry, NativeModules } from 'react-native'

import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { mySchema } from './src/models/schema'
import Blog from './src/models/Blog'
import Post from './src/models/Post'
import Comment from './src/models/Comment'

import { createNavigation } from './src/components/helpers/Navigation'

const adapter = new SQLiteAdapter({
  dbName: 'WatermelonDemo',
  schema: mySchema,
})

const database = new Database({
  adapter,
  modelClasses: [Blog, Post, Comment],
})

// const appStartedLaunchingAt = NativeModules.NozbePlugin.appInitTimestamp

// const timeToLaunch = new Date().getTime() - appStartedLaunchingAt

const Navigation = createNavigation({ database, timeToLaunch: 0 })

AppRegistry.registerComponent('App', () => Navigation)
