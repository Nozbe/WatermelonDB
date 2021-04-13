declare module '@nozbe/watermelondb/DatabaseProvider' {
  import * as React from 'react'
  import Database from '@nozbe/watermelondb/Database'

  type GetProps<C> = C extends React.ComponentType<infer P & { database?: Database }> ? P : never

  type Statics<C extends React.ComponentType<any>> = { [K in keyof C]: C[K] }

  export const DatabaseContext: React.Context<Database>

  export interface DatabaseProviderProps {
    children?: React.ReactChild // only one child is allowed, goes through React.Children.only
    database: Database
  }

  export const DatabaseProviderComponent: React.ComponentClass<DatabaseProviderProps>

  export function withDatabase<
    C extends React.ComponentType<P>,
    P = GetProps<C>,
    R = Omit<P, 'database'>
  >(Component: C): React.FunctionComponent<R> & Statics<C>

  export default DatabaseProviderComponent
}
