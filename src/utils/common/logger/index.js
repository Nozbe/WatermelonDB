// @flow
/* eslint-disable no-console */

const formatMessages = (first, ...other) => {
  return [typeof first === 'string' ? `[🍉] ${first}` : first, ...other]
}

class Logger {
  silent: boolean = false

  log(...messages: any[]): void {
    !this.silent && console.log(...formatMessages(messages))
  }

  warn(...messages: any[]): void {
    !this.silent && console.warn(...formatMessages(messages))
  }

  error(...messages: any[]): void {
    !this.silent && console.error(...formatMessages(messages))
  }

  silence(): void {
    this.silent = true
  }
}

export default (new Logger(): Logger)
