/* eslint-disable no-console */
// @flow

const SQLite = require('tauri-plugin-sql').default
const {removeFile} = require('@tauri-apps/api/fs')
const { appConfigDir } = require('@tauri-apps/api/path')


class Database {
  instance: TauriDB
  path: string

  constructor(path: string = ':memory:'): void {
    this.path = path
  }

  async open(): Promise<void> {
    try {
      this.instance = await SQLite.load(`sqlite:${this.path}`)
    } catch (error) {
      throw new Error(`Failed to open the database. - ${error}`)
    }

    if (!this.instance) {
      throw new Error('Failed to open the database.')
    }
  }

  async inTransaction(executeBlock: () => Promise<void>): Promise<void> {
    try {
      await this.instance.execute('BEGIN TRANSACTION')
      await executeBlock()
      await this.instance.execute('COMMIT')
    } catch (error) {
      console.log('Error in transaction', error)
      await this.instance.execute('ROLLBACK')
      throw error
    }
  }

  async execute(query: string, args: any[] = []): Promise<any> {
    return this.instance.select(query, args)
  }

  async executeStatements(queries: string): Promise<any> {
    return this.instance.execute(queries, [])
  }

  async queryRaw(query: string, args: any[] = []): Promise<any | any[]> {
    return this.instance.select(query, args)
  }

  async count(query: string, args: any[] = []): Promise<number> {
    const results = await this.instance.select(query, args)
    if (results.length === 0) {
      throw new Error('Invalid count query, can`t find next() on the result')
    }

    const result = results[0]

    return Number.parseInt(result.count, 10)
  }

  async userVersion(): Promise<number> {
    const results = await this.instance.select('PRAGMA user_version')
    return results[0].user_version
  }

  async setUserVersion(version: number): Promise<void> {
    await this.instance.execute(`PRAGMA user_version = ${version}`)
  }

  async unsafeDestroyEverything(): Promise<void> {
    // Deleting files by default because it seems simpler, more reliable
    // And we have a weird problem with sqlite code 6 (database busy) in sync mode
    // But sadly this won't work for in-memory (shared) databases, so in those cases,
    // drop all tables, indexes, and reset user version to 0

    // if (this.isInMemoryDatabase()) {
    //   this.inTransaction(async () => {
    //     const results = await this.queryRaw(`SELECT * FROM sqlite_master WHERE type = 'table'`)
    //     const tables = results.map((table) => table.name)

    //     tables.forEach((table) => {
    //       this.execute(`DROP TABLE IF EXISTS '${table}'`)
    //     })

    //     this.execute('PRAGMA writable_schema=1')
    //     const count = (await this.queryRaw(`SELECT * FROM sqlite_master`)).length
    //     if (count) {
    //       // IF required to avoid SQLIte Error
    //       this.execute('DELETE FROM sqlite_master')
    //     }
    //     this.execute('PRAGMA user_version=0')
    //     this.execute('PRAGMA writable_schema=0')
    //   })
    // } else {
      await this.instance.close()
      const appConfigDirPath = await appConfigDir()
      await removeFile(`${appConfigDirPath}${this.path}`)
    //   // if (this.instance.open) {
    //   //   throw new Error('Could not close database')
    //   // }

    //   // if (fs.existsSync(this.path)) {
    //   //   fs.unlinkSync(this.path)
    //   // }
    //   // if (fs.existsSync(`${this.path}-wal`)) {
    //   //   fs.unlinkSync(`${this.path}-wal`)
    //   // }
    //   // if (fs.existsSync(`${this.path}-shm`)) {
    //   //   fs.unlinkSync(`${this.path}-shm`)
    //   // }

      await this.open()
    // }
    
    // TODO Tauri's sqlite plugin doesn't support any way to destroy the db
    // Need to take a look later how to achieve this
    // Closing it is possible but how to remove the file?
  }

  isInMemoryDatabase(): any {
    return false
  }
}

export default Database
