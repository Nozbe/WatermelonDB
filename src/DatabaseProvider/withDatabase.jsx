// @flow
import React from 'react'
import { Consumer } from '.'

// HoC to inject the database into the props of consumers
export default function withDatabase(
  Component: React.ComponentType<any>,
): React.ComponentType<any> {
  return function DatabaseComponent(props): React.ComponentType<any> {
    return <Consumer>{database => <Component {...props} database={database} />}</Consumer>
  }
}
