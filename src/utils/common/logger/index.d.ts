declare module '@BuildHero/watermelondb/utils/common/logger' {
  export default class Logger {
    log(...messages: any[]): void

    warn(...messages: any[]): void

    error(...messages: any[]): void

    silence(): void
  }
}
