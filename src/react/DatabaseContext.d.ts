import { Provider as ReactProvider, Consumer as ReactConsumer, Context } from 'react'
import type Database from '../Database'

type DatabaseContext = Context<Database>

export type DatabaseConsumer = ReactConsumer<any>
export type Provider = ReactProvider<any>

export default DatabaseContext
