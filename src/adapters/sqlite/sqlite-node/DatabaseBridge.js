// @flow

import DatabaseDriver from './DatabaseDriver'

type Connection = {
  driver: DatabaseDriver,
  queue: any[],
  status: string,
}

class DatabaseBridge {
  connections: { [key: number]: Connection } = {}

  // MARK: - Asynchronous connections

  connected(tag: number, driver: DatabaseDriver): void {
    this.connections[tag] = { driver, queue: [], status: 'connected' }
  }

  waiting(tag: number, driver: DatabaseDriver): void {
    this.connections[tag] = { driver, queue: [], status: 'waiting' }
  }

  initialize(
    tag: number,
    databaseName: string,
    schemaVersion: number,
    resolve: (status: { code: string, databaseVersion?: number }) => void,
    reject: () => void,
  ): void {
    let driver
    try {
      this.assertNoConnection(tag)
      driver = new DatabaseDriver()
      driver.initialize(databaseName, schemaVersion)
      this.connected(tag, driver)

      resolve({ code: 'ok' })
    } catch (error) {
      if (driver && error.type === 'SchemaNeededError') {
        this.waiting(tag, driver)
        resolve({ code: 'schema_needed' })
      } else if (driver && error.type === 'MigrationNeededError') {
        this.waiting(tag, driver)
        resolve({ code: 'migrations_needed', databaseVersion: error.databaseVersion })
      } else {
        this.sendReject(reject, error, 'initialize')
      }
    }
  }

  setUpWithSchema(
    tag: number,
    databaseName: string,
    schema: string,
    schemaVersion: number,
    resolve: (boolean) => void,
    _reject: () => void,
  ): void {
    const driver = new DatabaseDriver()
    driver.setUpWithSchema(databaseName, schema, schemaVersion)
    this.connectDriverAsync(tag, driver)
    resolve(true)
  }

  setUpWithMigrations(
    tag: number,
    databaseName: string,
    migrations: string,
    fromVersion: number,
    toVersion: number,
    resolve: (boolean) => void,
    reject: () => void,
  ): void {
    try {
      const driver = new DatabaseDriver()
      driver.setUpWithMigrations(databaseName, {
        from: fromVersion,
        to: toVersion,
        sql: migrations,
      })
      this.connectDriverAsync(tag, driver)
      resolve(true)
    } catch (error) {
      this.disconnectDriver(tag)
      this.sendReject(reject, error, 'setUpWithMigrations')
    }
  }

  // MARK: - Asynchronous actions

  find(
    tag: number,
    table: string,
    id: string,
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'find', (driver) => driver.find(table, id))
  }

  query(
    tag: number,
    table: string,
    query: string,
    args: any[],
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'query', (driver) =>
      driver.cachedQuery(table, query, args),
    )
  }

  queryIds(
    tag: number,
    query: string,
    args: any[],
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'queryIds', (driver) => driver.queryIds(query, args))
  }

  count(
    tag: number,
    query: string,
    args: any[],
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'count', (driver) => driver.count(query, args))
  }

  batch(tag: number, operations: any[], resolve: (any) => void, reject: (string) => void): void {
    this.withDriver(tag, resolve, reject, 'batch', (driver) => driver.batch(operations))
  }

  getDeletedRecords(
    tag: number,
    table: string,
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'getDeletedRecords', (driver) =>
      driver.getDeletedRecords(table),
    )
  }

  destroyDeletedRecords(
    tag: number,
    table: string,
    records: string[],
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'destroyDeletedRecords', (driver) =>
      driver.destroyDeletedRecords(table, records),
    )
  }

  unsafeResetDatabase(
    tag: number,
    schema: string,
    schemaVersion: number,
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'unsafeResetDatabase', (driver) =>
      driver.unsafeResetDatabase({ version: schemaVersion, sql: schema }),
    )
  }

  getLocal(tag: number, key: string, resolve: (any) => void, reject: (string) => void): void {
    this.withDriver(tag, resolve, reject, 'getLocal', (driver) => driver.getLocal(key))
  }

  setLocal(
    tag: number,
    key: string,
    value: string,
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'setLocal', (driver) => driver.setLocal(key, value))
  }

  removeLocal(tag: number, key: string, resolve: (any) => void, reject: (string) => void): void {
    this.withDriver(tag, resolve, reject, 'removeLocal', (driver) => driver.removeLocal(key))
  }

  // MARK: - Helpers

  withDriver(
    tag: number,
    resolve: (any) => void,
    reject: (any) => void,
    functionName: string,
    action: (driver: DatabaseDriver) => any,
  ): void {
    try {
      const connection = this.connections[tag]
      if (!connection) {
        throw new Error(`No driver for with tag ${tag} available`)
      }
      if (connection.status === 'connected') {
        const result = action(connection.driver)
        resolve(result)
      } else if (connection.status === 'waiting') {
        // consoleLog('Operation for driver (tagID) enqueued')
        // try again when driver is ready
        connection.queue.push(() => {
          this.withDriver(tag, resolve, reject, functionName, action)
        })
      }
    } catch (error) {
      this.sendReject(reject, error, functionName)
    }
  }

  connectDriverAsync(tag: number, driver: DatabaseDriver): void {
    const { queue = [] } = this.connections[tag]
    this.connections[tag] = { driver, queue: [], status: 'connected' }

    queue.forEach((operation) => operation())
  }

  disconnectDriver(tag: number): void {
    const { queue = [] } = this.connections[tag]
    delete this.connections[tag]

    queue.forEach((operation) => operation())
  }

  assertNoConnection(tag: number): void {
    if (this.connections[tag]) {
      throw new Error(`A driver with tag ${tag} already set up`)
    }
  }

  sendReject(reject: (string, string, Error) => void, error: Error, functionName: string): void {
    if (reject) {
      reject(`db.${functionName}.error`, error.message, error)
    } else {
      throw new Error(`db.${functionName} missing reject (${error.message})`)
    }
  }
}

const databaseBridge: DatabaseBridge = new DatabaseBridge()

export default databaseBridge
