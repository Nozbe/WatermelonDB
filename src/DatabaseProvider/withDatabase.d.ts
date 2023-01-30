import * as React from 'react'
import { NonReactStatics } from 'hoist-non-react-statics'
import type Database from '../Database'

type WithDatabaseProps<T> = T & {
  database: Database
}

type GetProps<C> = C extends React.ComponentType<infer P & { database?: Database }> ? P : never

// HoC to inject the database into the props of consumers
export default function withDatabase<
C extends React.ComponentType<any>,
P = GetProps<C>,
R = Omit<P, 'database'>
>(Component: C): React.FunctionComponent<R> & NonReactStatics<C>