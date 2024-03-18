// @flow

import Database from './Database'

function fixArgs(args: any[]): any[] {
  return args.map((value) => {
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    return value
  })
}

type Migrations = { from: number, to: number, sql: string }

class MigrationNeededError extends Error {
  databaseVersion: number

  type: string

  constructor(databaseVersion: number): void {
    super('MigrationNeededError')
    this.databaseVersion = databaseVersion
    this.type = 'MigrationNeededError'
    this.message = 'MigrationNeededError'
  }
}

class SchemaNeededError extends Error {
  type: string

  constructor(): void {
    super('SchemaNeededError')
    this.type = 'SchemaNeededError'
    this.message = 'SchemaNeededError'
  }
}

export function getPath(dbName: string): string {
  if (dbName === ':memory:' || dbName === 'file::memory:') {
    return dbName
  }

  let path = dbName
    // dbName.startsWith('/') || dbName.startsWith('file:') ? dbName : `${process.cwd()}/${dbName}`
  if (path.indexOf('.db') === -1) {
    if (path.indexOf('?') >= 0) {
      const index = path.indexOf('?')
      path = `${path.substring(0, index)}.db${path.substring(index)}`
    } else {
      path = `${path}.db`
    }
  }

  return path
}

class DatabaseDriver {
  static sharedMemoryConnections: { [dbName: string]: Database } = {}

  database: Database

  cachedRecords: any = {}

  async initialize(dbName: string, schemaVersion: number): Promise<void> {
    await this.init(dbName)
    await this.isCompatible(schemaVersion)
  }

  async setUpWithSchema(dbName: string, schema: string, schemaVersion: number): Promise<void> {
    await this.init(dbName)
    await this.unsafeResetDatabase({ version: schemaVersion, sql: schema })
    await this.isCompatible(schemaVersion)
  }

  async setUpWithMigrations(dbName: string, migrations: Migrations): Promise<void> {
    await this.init(dbName)
    await this.migrate(migrations)
    await this.isCompatible(migrations.to)
  }

  async init(dbName: string): Promise<void> {
    this.database = new Database(getPath(dbName))
    await this.database.open()

    // const isSharedMemory = dbName.indexOf('mode=memory') > 0 && dbName.indexOf('cache=shared') > 0
    // if (isSharedMemory) {
    //   if (!DatabaseDriver.sharedMemoryConnections[dbName]) {
    //     DatabaseDriver.sharedMemoryConnections[dbName] = this.database
    //   }
    //   this.database = DatabaseDriver.sharedMemoryConnections[dbName]
    // }
  }

  async find(table: string, id: string): Promise<any | null | string> {
    if (this.isCached(table, id)) {
      return id
    }

    const query = `SELECT * FROM '${table}' WHERE id == ? LIMIT 1`
    const results = await this.database.queryRaw(query, [id])

    if (results.length === 0) {
      return null
    }

    this.markAsCached(table, id)
    return results[0]
  }

  async cachedQuery(table: string, query: string, args: any[]): Promise<any[]> {
    const results = await this.database.queryRaw(query, fixArgs(args))
    return results.map((row: any) => {
      const id = `${row.id}`
      if (this.isCached(table, id)) {
        return id
      }
      this.markAsCached(table, id)
      return row
    })
  }

  async queryIds(query: string, args: any[]): Promise<string[]> {
    const results = await this.database.queryRaw(query, fixArgs(args))
    return results.map((row) => `${row.id}`)
  }

  async unsafeQueryRaw(query: string, args: any[]): Promise<any[]> {
    return this.database.queryRaw(query, fixArgs(args))
  }

  async count(query: string, args: any[]): Promise<number> {
    return this.database.count(query, fixArgs(args))
  }

  async batch(operations: any[]): Promise<void> {
    const newIds = []
    const removedIds = []

    await this.database.inTransaction(async () => {
      for (const operation of operations) {
        const [cacheBehavior, table, sql, argBatches] = operation
        for (const args of argBatches) {
          await this.database.execute(sql, fixArgs(args))
          if (cacheBehavior === 1) {
            newIds.push([table, args[0]])
          } else if (cacheBehavior === -1) {
            removedIds.push([table, args[0]])
          }
        }
      }
    })

    newIds.forEach(([table, id]) => {
      this.markAsCached(table, id)
    })

    removedIds.forEach(([table, id]) => {
      this.removeFromCache(table, id)
    })
  }

  // MARK: - LocalStorage

  async getLocal(key: string): any | null {
    const results = await this.database.queryRaw('SELECT `value` FROM `local_storage` WHERE `key` = ?', [
      key,
    ])

    if (results.length > 0) {
      return results[0].value
    }

    return null
  }

  // MARK: - Record caching

  hasCachedTable(table: string): any {
    // $FlowFixMe
    return Object.prototype.hasOwnProperty.call(this.cachedRecords, table)
  }

  isCached(table: string, id: string): boolean {
    if (this.hasCachedTable(table)) {
      return this.cachedRecords[table].has(id)
    }
    return false
  }

  markAsCached(table: string, id: string): void {
    if (!this.hasCachedTable(table)) {
      this.cachedRecords[table] = new Set()
    }
    this.cachedRecords[table].add(id)
  }

  removeFromCache(table: string, id: string): void {
    if (this.hasCachedTable(table) && this.cachedRecords[table].has(id)) {
      this.cachedRecords[table].delete(id)
    }
  }

  // MARK: - Other private details

  async isCompatible(schemaVersion: number): Promise<void> {
    const databaseVersion = await this.database.userVersion()
    if (schemaVersion !== databaseVersion) {
      if (databaseVersion > 0 && databaseVersion < schemaVersion) {
        throw new MigrationNeededError(databaseVersion)
      } else {
        throw new SchemaNeededError()
      }
    }
  }

  async unsafeResetDatabase(schema: { sql: string, version: number }): Promise<void> {
    await this.database.unsafeDestroyEverything()
    this.cachedRecords = {}

    await this.database.inTransaction(async () => {
      await this.database.executeStatements(schema.sql)
      await this.database.setUserVersion(schema.version)
    })
  }

  async migrate(migrations: Migrations): Promise<void> {
    const databaseVersion = await this.database.userVersion()

    if (`${databaseVersion}` !== `${migrations.from}`) {
      throw new Error(
        `Incompatbile migration set applied. DB: ${databaseVersion}, migration: ${migrations.from}`,
      )
    }

    await this.database.inTransaction(async () => {
      await this.database.executeStatements(migrations.sql)
      this.database.setUserVersion(migrations.to)
    })
  }
}

export default DatabaseDriver
