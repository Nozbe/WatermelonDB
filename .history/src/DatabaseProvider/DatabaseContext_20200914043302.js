// @flow
import React from 'react'

const DatabaseContext = (React.createContext(): any)
const { Provider, Consumer } = DatabaseContext

export {
  Consumer as DatabaseConsumer,
  Provider, 
}

export default DatabaseContext
