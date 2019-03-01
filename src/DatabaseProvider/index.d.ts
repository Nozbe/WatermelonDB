declare module '@nozbe/watermelondb/DatabaseProvider' {
  import * as React from 'react'
  import Database from '@nozbe/watermelondb/Database'

  export interface DatabaseProviderProps {
    children?: React.ReactChild // only one child is allowed, goes through React.Children.only
    database: Database
  }

  export const DatabaseProviderComponent: React.ComponentClass<DatabaseProviderProps>

  /**
   * HOC
   * https://gist.github.com/thehappybug/88342c122cfb1df9f14c9a10fb4926e4
   */
  type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
  export function withDatabase<P extends { database?: Database }, R = Omit<P, 'database'>>(
    Component: React.ComponentType<P> | React.FunctionComponent<P>,
  ): React.FunctionComponent<R>

  export default DatabaseProviderComponent
}
