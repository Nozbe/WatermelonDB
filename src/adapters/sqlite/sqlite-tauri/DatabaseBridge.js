// @flow

import DatabaseDriver from './DatabaseDriver'

type Connection = {
  driver: DatabaseDriver,
  queue: any[],
  status: string,
}

class DatabaseBridge {
  connections: { [key: number]: Connection } = {}
  _initializationPromiseResolve: () => void = () => {}
  _initializationPromise: Promise<any> = new Promise((resolve) => {this._initializationPromiseResolve = resolve})
  _operationLock: Promise<any> | null = null

  // MARK: - Asynchronous connections

  connected(tag: number, driver: DatabaseDriver): void {
    this.connections[tag] = { driver, queue: [], status: 'connected' }
  }

  waiting(tag: number, driver: DatabaseDriver): void {
    this.connections[tag] = { driver, queue: [], status: 'waiting' }
  }

  async initialize(
    tag: number,
    databaseName: string,
    schemaVersion: number,
    resolve: (status: { code: string, databaseVersion?: number }) => void,
    reject: () => void,
  ): Promise<void> {
    let driver
    try {
      this.assertNoConnection(tag)
      driver = new DatabaseDriver()
      await driver.initialize(databaseName, schemaVersion)
      this._initializationPromiseResolve()
      this.connected(tag, driver)

      resolve({ code: 'ok' })
    } catch (error) {
      if (driver && error.type === 'SchemaNeededError') {
        this.waiting(tag, driver)
        this._initializationPromiseResolve()
        resolve({ code: 'schema_needed' })
      } else if (driver && error.type === 'MigrationNeededError') {
        this.waiting(tag, driver)
        this._initializationPromiseResolve()
        resolve({ code: 'migrations_needed', databaseVersion: error.databaseVersion })
      } else {
        this.sendReject(reject, error, 'initialize')
      }
    }
  }

  async setUpWithSchema(
    tag: number,
    databaseName: string,
    schema: string,
    schemaVersion: number,
    resolve: (boolean) => void,
    _reject: () => void,
  ): Promise<void> {
    const driver = new DatabaseDriver()
    await driver.setUpWithSchema(databaseName, schema, schemaVersion)
    this.connectDriverAsync(tag, driver)
    this._initializationPromiseResolve()
    resolve(true)
  }

  async setUpWithMigrations(
    tag: number,
    databaseName: string,
    migrations: string,
    fromVersion: number,
    toVersion: number,
    resolve: (boolean) => void,
    reject: () => void,
  ): Promise<void> {
    try {
      const driver = new DatabaseDriver()
      await driver.setUpWithMigrations(databaseName, {
        from: fromVersion,
        to: toVersion,
        sql: migrations,
      })
      this.connectDriverAsync(tag, driver)
      this._initializationPromiseResolve()
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

  unsafeQueryRaw(
    tag: number,
    query: string,
    args: any[],
    resolve: (any) => void,
    reject: (string) => void,
  ): void {
    this.withDriver(tag, resolve, reject, 'unsafeQueryRaw', (driver) =>
      driver.unsafeQueryRaw(query, args),
    )
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

  // getLocal(tag: number, key: string, resolve: (any) => void, reject: (string) => void): void {
  //   this.withDriver(tag, resolve, reject, 'getLocal', (driver) => driver.getLocal(key))
  // }

  // MARK: - Helpers

  async withDriver(
    tag: number,
    resolve: (any) => void,
    reject: (any) => void,
    functionName: string,
    action: (driver: DatabaseDriver) => Promise<any>,
  ): Promise<void> {
    try {
      await this._initializationPromise
      const connection = this.connections[tag]
      
      if (!connection) {
        throw new Error(`No driver for with tag ${tag} available, called from ${functionName}`)
      }

      if (connection.status === 'connected') {
        if(this._operationLock) {
          await this._operationLock
        }

        this._operationLock = action(connection.driver)
        const result = await this._operationLock
        
        resolve(result)
        this._operationLock = null
      } else if (connection.status === 'waiting') {
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
