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

  connected: (tag: number, driver: DatabaseDriver) => void = (
    tag: number,
    driver: DatabaseDriver,
  ) => {
    this.connections[tag] = { driver, queue: [], status: 'connected' }
  }

  waiting: (tag: number, driver: DatabaseDriver) => void = (
    tag: number,
    driver: DatabaseDriver,
  ) => {
    this.connections[tag] = { driver, queue: [], status: 'waiting' }
  }

  initialize: (
    tag: number,
    databaseName: string,
    schemaVersion: number,
    resolve: (status: { code: string, databaseVersion?: number, ... }) => void,
    reject: () => void,
  ) => void = (
    tag: number,
    databaseName: string,
    schemaVersion: number,
    resolve: (status: { code: string, databaseVersion?: number }) => void,
    reject: () => void,
  ) => {
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

  setUpWithSchema: (
    tag: number,
    databaseName: string,
    schema: string,
    schemaVersion: number,
    resolve: (boolean) => void,
    _reject: () => void,
  ) => void = (
    tag: number,
    databaseName: string,
    schema: string,
    schemaVersion: number,
    resolve: (boolean) => void,
    _reject: () => void,
  ) => {
    const driver = new DatabaseDriver()
    driver.setUpWithSchema(databaseName, schema, schemaVersion)
    this.connectDriverAsync(tag, driver)
    resolve(true)
  }

  setUpWithMigrations: (
    tag: number,
    databaseName: string,
    migrations: string,
    fromVersion: number,
    toVersion: number,
    resolve: (boolean) => void,
    reject: () => void,
  ) => void = (
    tag: number,
    databaseName: string,
    migrations: string,
    fromVersion: number,
    toVersion: number,
    resolve: (boolean) => void,
    reject: () => void,
  ) => {
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

  find: (
    tag: number,
    table: string,
    id: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (
    tag: number,
    table: string,
    id: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => this.withDriver(tag, resolve, reject, 'find', (driver) => driver.find(table, id))

  query: (
    tag: number,
    table: string,
    query: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (
    tag: number,
    table: string,
    query: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => this.withDriver(tag, resolve, reject, 'query', (driver) => driver.cachedQuery(table, query))

  count: (tag: number, query: string, resolve: (any) => void, reject: (string) => void) => void = (
    tag: number,
    query: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => this.withDriver(tag, resolve, reject, 'count', (driver) => driver.count(query))

  batchJSON: (
    tag: number,
    operations: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (tag: number, operations: string, resolve: (any) => void, reject: (string) => void) =>
    this.withDriver(tag, resolve, reject, 'batchJSON', (driver) =>
      driver.batch(this.toBatchOperations(operations)),
    )

  batch: (
    tag: number,
    operations: Array<Array<any>>,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (
    tag: number,
    operations: any[][],
    resolve: (any) => void,
    reject: (string) => void,
  ) =>
    this.withDriver(tag, resolve, reject, 'batch', (driver) =>
      driver.batch(this.toBatchOperations(operations)),
    )

  getDeletedRecords: (
    tag: number,
    table: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (tag: number, table: string, resolve: (any) => void, reject: (string) => void) =>
    this.withDriver(tag, resolve, reject, 'getDeletedRecords', (driver) =>
      driver.getDeletedRecords(table),
    )

  destroyDeletedRecords: (
    tag: number,
    table: string,
    records: Array<string>,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (
    tag: number,
    table: string,
    records: string[],
    resolve: (any) => void,
    reject: (string) => void,
  ) =>
    this.withDriver(tag, resolve, reject, 'destroyDeletedRecords', (driver) =>
      driver.destroyDeletedRecords(table, records),
    )

  unsafeResetDatabase: (
    tag: number,
    schema: string,
    schemaVersion: number,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (
    tag: number,
    schema: string,
    schemaVersion: number,
    resolve: (any) => void,
    reject: (string) => void,
  ) =>
    this.withDriver(tag, resolve, reject, 'unsafeResetDatabase', (driver) =>
      driver.unsafeResetDatabase({ version: schemaVersion, sql: schema }),
    )

  getLocal: (tag: number, key: string, resolve: (any) => void, reject: (string) => void) => void = (
    tag: number,
    key: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => this.withDriver(tag, resolve, reject, 'getLocal', (driver) => driver.getLocal(key))

  setLocal: (
    tag: number,
    key: string,
    value: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (
    tag: number,
    key: string,
    value: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => this.withDriver(tag, resolve, reject, 'setLocal', (driver) => driver.setLocal(key, value))

  removeLocal: (
    tag: number,
    key: string,
    resolve: (any) => void,
    reject: (string) => void,
  ) => void = (tag: number, key: string, resolve: (any) => void, reject: (string) => void) =>
    this.withDriver(tag, resolve, reject, 'removeLocal', (driver) => driver.removeLocal(key))

  // MARK: - Helpers

  toBatchOperations: (operations: any) => any = (operations: any) => {
    if (typeof operations === 'string') {
      try {
        return JSON.parse(operations)
      } catch (error) {
        //
      }
    }
    return operations
  }

  withDriver: (
    tag: number,
    resolve: (any) => void,
    reject: (any) => void,
    functionName: string,
    action: (driver: DatabaseDriver) => any,
  ) => void = (
    tag: number,
    resolve: (any) => void,
    reject: (any) => void,
    functionName: string,
    action: (driver: DatabaseDriver) => any,
  ) => {
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

  connectDriverAsync: (tag: number, driver: DatabaseDriver) => void = (
    tag: number,
    driver: DatabaseDriver,
  ) => {
    const { queue = [] } = this.connections[tag]
    this.connections[tag] = { driver, queue: [], status: 'connected' }

    queue.forEach((operation) => operation())
  }

  disconnectDriver: (tag: number) => void = (tag: number) => {
    const { queue = [] } = this.connections[tag]
    delete this.connections[tag]

    queue.forEach((operation) => operation())
  }

  assertNoConnection: (tag: number) => void = (tag: number) => {
    if (this.connections[tag]) {
      throw new Error(`A driver with tag ${tag} already set up`)
    }
  }

  sendReject: (
    reject: (string, string, Error) => void,
    error: Error,
    functionName: string,
  ) => void = (reject: (string, string, Error) => void, error: Error, functionName: string) => {
    if (reject) {
      reject(`db.${functionName}.error`, error.message, error)
    } else {
      throw new Error(`db.${functionName} missing reject (${error.message})`)
    }
  }
}

const databaseBridge: DatabaseBridge = new DatabaseBridge()

export default databaseBridge
