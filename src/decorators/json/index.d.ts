import { ColumnName } from '../../Schema'
import Model from '../../Model'

export type Sanitizer = (source: any, model?: Model) => any

export type Options = {
  /** Use cached value if possible rather than sanitizing the raw value for every read. Default: `false` */
  memo: boolean
}

declare function json(
  rawFieldName: ColumnName,
  sanitizer: Sanitizer,
  options?: Options,
): PropertyDecorator

export default json
