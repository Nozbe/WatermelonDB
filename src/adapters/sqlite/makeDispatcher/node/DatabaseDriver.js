// @flow

import Database from './Database'

function fixArgs(args: any): any {
  return Object.keys(args).reduce((acc, argName) => {
    if (typeof acc[argName] === 'boolean') {
      acc[argName] = acc[argName] ? 1 : 0
    }
    return acc
  }, args)
}

type Migrations = { from: number, to: number, sql: string }

class MigrationNeededError extends Error {
  databaseVersion: number

  type: string

  constructor(databaseVersion): void {
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

function getPath(dbName): string {
  // If starts with `file:` or contains `/`, it's a path!
  if (dbName === ':memory:' || dbName.indexOf('file:') === 0 || dbName.indexOf('/') >= 0) {
    return dbName
  }
  return `${process.cwd()}/${dbName}`
}

class DatabaseDriver {
  static sharedMemoryConnections = {}

  database: Database

  cachedRecords: any = {}

  initialize = (dbName: string, schemaVersion: number) => {
    this.init(dbName)
    this.isCompatible(schemaVersion)
  }

  setUpWithSchema = (dbName: string, schema: string, schemaVersion: number) => {
    this.init(dbName)
    this.unsafeResetDatabase({ version: schemaVersion, sql: schema })
    this.isCompatible(schemaVersion)
  }

  setUpWithMigrations = (dbName: string, migrations: Migrations) => {
    this.init(dbName)
    this.migrate(migrations)
    this.isCompatible(migrations.to)
  }

  init = (dbName: string) => {
    this.database = new Database(getPath(dbName))

    const isSharedMemory = dbName.indexOf('mode=memory') > 0 && dbName.indexOf('cache=shared') > 0
    if (isSharedMemory) {
      if (!DatabaseDriver.sharedMemoryConnections[dbName]) {
        DatabaseDriver.sharedMemoryConnections[dbName] = this.database
      }
      this.database = DatabaseDriver.sharedMemoryConnections[dbName]
    }
  }

  find = (table: string, id: string) => {
    if (this.isCached(table, id)) {
      return id
    }

    const query = `SELECT * FROM '${table}' WHERE id == ? LIMIT 1`
    const results = this.database.queryRaw(query, [id])

    if (results.length === 0) {
      return null
    }

    this.markAsCached(table, id)
    return results[0]
  }

  cachedQuery = (table: string, query: string): any[] => {
    const results = this.database.queryRaw(query)
    return results.map((row: any) => {
      const id = `${row.id}`
      if (this.isCached(table, id)) {
        return id
      }
      this.markAsCached(table, id)
      return row
    })
  }

  query = (table: string, query: string) => this.cachedQuery(table, query)

  count = (query: string) => this.database.count(query)

  batch = (operations: any[]) => {
    const newIds = []
    const removedIds = []

    this.database.inTransaction(() => {
      operations.forEach((operation: any[]) => {
        const [type, table, ...rest] = operation
        switch (type) {
          case 'execute': {
            const [query, args] = rest
            this.database.execute(query, fixArgs(args))
            break
          }

          case 'create': {
            const [id, query, args] = rest
            this.database.execute(query, fixArgs(args))
            newIds.push([table, id])
            break
          }

          case 'markAsDeleted': {
            const [id] = rest
            const query = `UPDATE '${table}' SET _status='deleted' WHERE id == ?`
            this.database.execute(query, [id])
            removedIds.push([table, id])
            break
          }

          case 'destroyPermanently': {
            const [id] = rest
            // TODO: What's the behavior if nothing got deleted?
            this.database.execute(`DELETE FROM '${table}' WHERE id == ?`, [id])
            removedIds.push([table, id])
            break
          }

          default: {
            break
          }
        }
      })
    })

    newIds.forEach(([table, id]) => {
      this.markAsCached(table, id)
    })

    removedIds.forEach(([table, id]) => {
      this.removeFromCache(table, id)
    })
  }

  getDeletedRecords = (table: string): string[] => {
    return this.database
      .queryRaw(`SELECT ID FROM '${table}' WHERE _status='deleted'`)
      .map(row => `${row.id}`)
  }

  destroyDeletedRecords = (table: string, records: string[]) => {
    const recordPlaceholders = records.map(() => '?').join(',')
    this.database.execute(`DELETE FROM '${table}' WHERE id IN (${recordPlaceholders})`, records)
  }

  // MARK: - LocalStorage

  getLocal = (key: string) => {
    const results = this.database.queryRaw('SELECT `value` FROM `local_storage` WHERE `key` = ?', [
      key,
    ])

    if (results.length > 0) {
      return results[0].value
    }

    return null
  }

  setLocal = (key: string, value: any) => {
    this.database.execute('INSERT OR REPLACE INTO `local_storage` (key, value) VALUES (?, ?)', [
      key,
      `${value}`,
    ])
  }

  removeLocal = (key: string) => {
    this.database.execute('DELETE FROM `local_storage` WHERE `key` == ?', [key])
  }

  // MARK: - Record caching

  hasCachedTable = (table: string) =>
    Object.prototype.hasOwnProperty.call(this.cachedRecords, table)

  isCached = (table: string, id: string) => {
    if (this.hasCachedTable(table)) {
      return this.cachedRecords[table].has(id)
    }
    return false
  }

  markAsCached = (table: string, id: string) => {
    if (!this.hasCachedTable(table)) {
      this.cachedRecords[table] = new Set()
    }
    this.cachedRecords[table].add(id)
  }

  removeFromCache = (table: string, id: string) => {
    if (this.cachedRecords[table] && this.cachedRecords[table].has(id)) {
      this.cachedRecords[table].delete(id)
    }
  }

  // MARK: - Other private details

  isCompatible = (schemaVersion: number) => {
    const databaseVersion = this.database.userVersion
    if (schemaVersion !== databaseVersion) {
      if (databaseVersion > 0 && databaseVersion < schemaVersion) {
        throw new MigrationNeededError(databaseVersion)
      } else {
        throw new SchemaNeededError()
      }
    }
  }

  unsafeResetDatabase = (schema: { sql: string, version: number }) => {
    this.database.unsafeDestroyEverything()
    this.cachedRecords = {}

    this.setUpSchema(schema)
  }

  setUpSchema = (schema: { sql: string, version: number }) => {
    this.database.inTransaction(() => {
      this.database.executeStatements(schema.sql + this.localStorageSchema)
      this.database.userVersion = schema.version
    })
  }

  migrate = (migrations: Migrations) => {
    const databaseVersion = this.database.userVersion

    if (`${databaseVersion}` !== `${migrations.from}`) {
      throw new Error(
        `Incompatbile migration set applied. DB: ${databaseVersion}, migration: ${migrations.from}`,
      )
    }

    this.database.inTransaction(() => {
      this.database.executeStatements(migrations.sql)
      this.database.userVersion = migrations.to
    })
  }

  localStorageSchema: string = `
      create table local_storage (
      key varchar(16) primary key not null,
      value text not null
      );

      create index local_storage_key_index on local_storage (key);
      `
}

export default DatabaseDriver
