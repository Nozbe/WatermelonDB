declare module '@nozbe/watermelondb/decorators/common' {
  import { ColumnName } from '@nozbe/watermelondb'

  export function ensureDecoratorUsedProperly(
    columnName: ColumnName,
    target: Object,
    key: string,
    descriptor: Object,
  ): void
}
