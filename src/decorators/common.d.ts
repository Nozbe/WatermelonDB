declare module '@BuildHero/watermelondb/decorators/common' {
  import { ColumnName } from '@BuildHero/watermelondb'

  export function ensureDecoratorUsedProperly(
    columnName: ColumnName,
    target: Object,
    key: string,
    descriptor: Object,
  ): void
}
