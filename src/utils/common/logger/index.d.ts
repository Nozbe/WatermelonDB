declare class Logger {
  silent: boolean

  log(...messages: any[]): void

  warn(...messages: any[]): void

  error(...messages: any[]): void

  silence(): void
}

declare const logger: Logger

export default logger
