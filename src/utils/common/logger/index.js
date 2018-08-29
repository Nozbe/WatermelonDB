// @flow
/* eslint-disable no-console */

class Logger {
  silent = false

  log(...messages: any[]): void {
    !this.silent && console.log(...messages)
  }

  warn(...messages: any[]): void {
    !this.silent && console.warn(...messages)
  }

  error(...messages: any[]): void {
    !this.silent && console.error(...messages)
  }

  silence(): void {
    this.silent = true
  }
}

export default new Logger()
