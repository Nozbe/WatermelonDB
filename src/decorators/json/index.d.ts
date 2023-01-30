import { ColumnName } from '../../Schema'
import Model from '../../Model'

export type Sanitizer = (source: any, model?: Model) => any

declare function json(rawFieldName: ColumnName, sanitizer: Sanitizer): PropertyDecorator

export default json
