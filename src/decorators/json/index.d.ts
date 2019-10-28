declare module '@nozbe/watermelondb/decorators/json' {
  import { ColumnName, Model } from '@nozbe/watermelondb'
  import { Decorator, RawDecorator } from '@nozbe/watermelondb/utils/common/makeDecorator'

  type Sanitizer = (source: any, model?: Model) => any

  const json: Decorator<
    [ColumnName, Sanitizer],
    (rawFieldName: ColumnName, sanitizer: Sanitizer) => RawDecorator
  >

  export default json
}
