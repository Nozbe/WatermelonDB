declare module '@nozbe/watermelondb/decorators/json' {
  import { ColumnName, Model } from '@nozbe/watermelondb'

  type Sanitizer = (source: any, model?: Model) => any

  const json: (rawFieldName: ColumnName, sanitizer: Sanitizer) => PropertyDecorator

  export default json
}
