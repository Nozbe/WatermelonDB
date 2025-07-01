import invariant from '../utils/common/invariant';
import checkName from '../utils/fp/checkName'
import type { $RE } from '../types'

import type Model from '../Model'

export type TableName<T extends Model> = string;
export type ColumnName = string;

export type ColumnType = 'string' | 'number' | 'boolean';
export type ColumnSchema = $RE<{
  name: ColumnName;
  type: ColumnType;
  isOptional?: boolean;
  isIndexed?: boolean;
}>;

export type ColumnMap = Partial<Record<ColumnName, ColumnSchema>>;

export type TableSchemaSpec = {
  name: TableName<any>;
  columns: ColumnName[];
  unsafeSql?: (arg1: string) => string;
};

export type FTS5TableSchemaSpec = {
  name: TableName<any>;
  columns: ColumnName[];
  contentTable: TableName<any>;
};

export type FTS5TableSchema = $RE<{
  name: TableName<any>;
  columns: ColumnName[];
  contentTable: TableName<any>;
}>;

export type TableSchema = $RE<{
  name: TableName<any>;
  // depending on operation, it's faster to use map or array
  columns: ColumnMap;
  columnArray: ColumnSchema[];
  unsafeSql?: (arg1: string) => string;
}>;

type TableMap = Partial<Record<TableName<any>, TableSchema>>;

export type SchemaVersion = number;

export type AppSchemaSpec = {
  version: number;
  tables: TableSchema[];
  fts5Tables?: FTS5TableSchema[];
  unsafeSql?: (arg1: string) => string;
};

export type AppSchema = $RE<{
  version: SchemaVersion;
  tables: TableMap;
  fts5Tables: FTS5TableSchema[] | null | undefined;
  unsafeSql: ((arg1: string) => string) | null | undefined;
}>;

export function tableName<T extends Model>(name: string): TableName<T> {
  return name
}

export function columnName(name: string): ColumnName {
  return name
}

export function appSchema(
  {
    version,
    tables: tableList,
    fts5Tables: fts5TableList = [],
    unsafeSql,
  }: AppSchemaSpec,
): AppSchema {
  if (process.env.NODE_ENV !== 'production') {
    invariant(version > 0, `Schema version must be greater than 0`)
  }

  const tables: TableMap = tableList.reduce<Record<string, any>>((map, table) => {
    if (process.env.NODE_ENV !== 'production') {
      invariant(typeof table === 'object' && table.name, `Table schema must contain a name`)
    }

    map[table.name] = table
    return map
  }, {});

  // @ts-ignore
  const fts5Tables: FTS5TableSchema[] = fts5TableList?.reduce((map: Record<any, any>, table) => {
    if (process.env.NODE_ENV !== 'production') {
      invariant(typeof table === 'object' && table.name, `Table schema must contain a name`)
    }

    map[table.name] = table

    return map
  }, {});

  return { version, tables, fts5Tables, unsafeSql }
}

const validateName = (name: string) => {
  if (process.env.NODE_ENV !== 'production') {
    invariant(
      !['id', '_changed', '_status', 'local_storage'].includes(name.toLowerCase()),
      `Invalid column or table name '${name}' - reserved by WatermelonDB`,
    )
    checkName(name)
  }
}

export function validateColumnSchema(column: ColumnSchema): void {
  if (process.env.NODE_ENV !== 'production') {
    invariant(column.name, `Missing column name`)
    validateName(column.name)
    invariant(
      ['string', 'boolean', 'number'].includes(column.type),
      `Invalid type ${column.type} for column '${column.name}' (valid: string, boolean, number)`,
    )
    if (column.name === 'created_at' || column.name === 'updated_at') {
      invariant(
        column.type === 'number' && !column.isOptional,
        `${column.name} must be of type number and not optional`,
      )
    }
    if (column.name === 'last_modified') {
      invariant(
        column.type === 'number',
        `For compatibility reasons, column last_modified must be of type 'number', and should be optional`,
      )
    }
  }
}

export function tableSchema(
  {
    name,
    columns: columnArray,
    unsafeSql,
  }: TableSchemaSpec,
): TableSchema {
  if (process.env.NODE_ENV !== 'production') {
    invariant(name, `Missing table name in schema`)
    validateName(name)
  }

  const columns: ColumnMap = columnArray.reduce<Record<string, any>>((map, column) => {
    if (process.env.NODE_ENV !== 'production') {
      validateColumnSchema(column as any);
    }
    // @ts-ignore
    map[column.name] = column;
    return map
  }, {});

  // @ts-ignore
  return { name, columns, columnArray, unsafeSql };
}

export function fts5TableSchema(
  {
    name,
    columns,
    contentTable,
  }: FTS5TableSchemaSpec,
): FTS5TableSchema {
  if (process.env.NODE_ENV !== 'production') {
    invariant(name, `Missing table name in schema`)
    validateName(name)
  }

  columns.forEach(columnName => {
    invariant(columnName, `Missing column name`)
    validateName(columnName)
  })

  return { name, columns, contentTable }
}
