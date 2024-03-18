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
      const transactionResult = await this.instance.execute('BEGIN TRANSACTION;')
      await executeBlock()
      await this.instance.execute('COMMIT;')
    } catch (error) {
      await this.instance.execute('ROLLBACK;')
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
    await this.instance.close()
    const appConfigDirPath = await appConfigDir()
    await removeFile(`${appConfigDirPath}${this.path}`)
    await this.open()
  }

  isInMemoryDatabase(): any {
    return false
  }
}

export default Database
