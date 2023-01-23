import type { NonReactStatics } from 'hoist-non-react-statics'
import { ComponentType } from 'react'
import type Database from '../Database'

type WithDatabaseProps<T> = T & {
  database: Database
}
// HoC to inject the database into the props of consumers
export default function withDatabase<T extends React.ComponentType<any>>(
  Component: ComponentType<WithDatabaseProps<T>>,
): React.FunctionComponent<Omit<T, 'database'>> & NonReactStatics<T>
