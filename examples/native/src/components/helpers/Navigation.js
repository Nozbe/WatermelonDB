import React from 'react'
import { createStackNavigator, createAppContainer } from 'react-navigation'

import Root from '../Root'
import Blog from '../Blog'
import ModerationQueue from '../ModerationQueue'
import Post from '../Post'

export const createNavigation = props =>
  createAppContainer(
    createStackNavigator(
      {
        Root: {
          // We have to use a little wrapper because React Navigation doesn't pass simple props (and withObservables needs that)
          screen: ({ navigation }) => {
            const { database, timeToLaunch } = navigation.state.params
            return <Root database={database} timeToLaunch={timeToLaunch} navigation={navigation} />
          },
          navigationOptions: { title: 'Blogs' },
        },
        Blog: {
          screen: ({ navigation }) => (
            <Blog blog={navigation.state.params.blog} navigation={navigation} />
          ),
          navigationOptions: ({ navigation }) => ({
            title: navigation.state.params.blog.name,
          }),
        },
        ModerationQueue: {
          screen: ({ navigation }) => <ModerationQueue blog={navigation.state.params.blog} />,
          navigationOptions: { title: 'Moderation Queue' },
        },
        Post: {
          screen: ({ navigation }) => <Post post={navigation.state.params.post} />,
          navigationOptions: ({ navigation }) => ({
            title: navigation.state.params.post.title,
          }),
        },
      },
      {
        initialRouteName: 'Root',
        initialRouteParams: props,
      },
    ),
  )
