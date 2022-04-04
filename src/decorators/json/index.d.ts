declare module '@BuildHero/watermelondb/decorators/json' {
  import { ColumnName, Model } from '@BuildHero/watermelondb'

  type Sanitizer = (source: any, model?: Model) => any

  const json: (rawFieldName: ColumnName, sanitizer: Sanitizer) => PropertyDecorator

  export default json
}
