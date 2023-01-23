import { ColumnName } from '../../Schema'
import Model from '../../Model'

type Sanitizer = (source: any, model?: Model) => any

type json = (rawFieldName: ColumnName, sanitizer: Sanitizer) => PropertyDecorator

export default json
