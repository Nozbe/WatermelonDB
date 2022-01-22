declare module '@nozbe/watermelondb/utils/common/logger' {
  class Logger {
    log(...messages: any[]): void

    warn(...messages: any[]): void

    error(...messages: any[]): void

    silence(): void
  }

  const logger: Logger

  export default logger
}
