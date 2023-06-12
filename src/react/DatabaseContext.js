// @flow
import React from 'react'
import type Database from '../Database'

const DatabaseContext: React$Context<Database> = React.createContext<Database>((undefined: any))
const { Provider, Consumer } = DatabaseContext

export { Consumer as DatabaseConsumer, Provider }

export default DatabaseContext
