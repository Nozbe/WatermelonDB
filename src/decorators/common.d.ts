import type { ColumnName } from '../Schema'

export function ensureDecoratorUsedProperly(
  columnName: ColumnName,
  target: Object,
  key: string,
  descriptor: Object,
): void
