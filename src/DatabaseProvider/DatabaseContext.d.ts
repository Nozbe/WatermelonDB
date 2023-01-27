import { Provider as ReactProvider, Consumer as ReactConsumer, Context } from 'react'

type DatabaseContext = Context<any>

export type DatabaseConsumer = ReactConsumer<any>
export type Provider = ReactProvider<any>

export default DatabaseContext
