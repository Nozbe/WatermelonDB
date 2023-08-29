import * as React from 'react'
import { withObservables, ExtractedObservables } from '@nozbe/watermelondb/src/react'
import { Model, Database, tableName } from '@nozbe/watermelondb'
import { expectType } from 'tsd-check'

const TableName_BLOGS = tableName<Blog>('blogs')

class Blog extends Model {
  static table = TableName_BLOGS
}

const TABLE_NAME = 'table'

const getObservables = ({
  id,
  model,
  database,
}: {
  id: string
  model: Blog
  database: Database
}) => {
  const model$ = database.collections.get(TableName_BLOGS).findAndObserve(id)
  return {
    model: model,
    keyChanged: model,
    observedModel: model.observe(),
    secondModel: model$,
  }
}

interface ChildProps extends ExtractedObservables<ReturnType<typeof getObservables>> {
  passThrough: string
}
class Child extends React.PureComponent<ChildProps> {
  static options = {
    header: 'Header Text',
  }
  render() {
    const { model, keyChanged, observedModel, secondModel, passThrough } = this.props
    return (
      <>
        <>{passThrough}</>
        <>{model.id}</>
        <>{keyChanged.id}</>
        <>{observedModel.id}</>
        <>{secondModel.id}</>
      </>
    )
  }
}

const WrappedChild = withObservables(['id'], getObservables)(Child)

// @ts-ignore
const database!: Database

const element = (
  <WrappedChild passThrough="abc" id="123" model={null as unknown as Blog} database={database} />
)

expectType<string>(WrappedChild.options.header)
