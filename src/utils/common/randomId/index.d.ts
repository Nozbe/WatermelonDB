declare module '@nozbe/watermelondb/utils/common/randomId' {
  export type Generator = () => string
  export function setGenerator(newGenenerator: Generator): void
}
