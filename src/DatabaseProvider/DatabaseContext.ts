import React from 'react'
import type Database from '../Database'
const DatabaseContext = React.createContext<Database | null>(null) as any
const { Provider, Consumer } = DatabaseContext

export { Consumer as DatabaseConsumer, Provider }

export default DatabaseContext
