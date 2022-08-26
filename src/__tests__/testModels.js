import { appSchema, tableSchema } from '../Schema'
import { field, relation, immutableRelation, text, readonly, date } from '../decorators'
import Model from '../Model'
import Database from '../Database'
import LokiJSAdapter from '../adapters/lokijs'

export const testSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'mock_projects',
      columns: [{ name: 'name', type: 'string' }],
    }),
    tableSchema({
      name: 'mock_tasks',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'position', type: 'number' },
        { name: 'is_completed', type: 'boolean' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'project_id', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'mock_comments',
      columns: [
        { name: 'task_id', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})

export class MockProject extends Model {
  static table = 'mock_projects'

  static associations = {
    mock_tasks: { type: 'has_many', foreignKey: 'project_id' },
  }

  @field('name')
  name
}

export class MockTask extends Model {
  static table = 'mock_tasks'

  static associations = {
    mock_projects: { type: 'belongs_to', key: 'project_id' },
    mock_comments: { type: 'has_many', foreignKey: 'task_id' },
  }

  @field('name') name

  @field('position') position

  @field('is_completed') isCompleted

  @field('description') description

  @field('project_id') projectId

  @relation('mock_projects', 'project_id') project
}

export class MockComment extends Model {
  static table = 'mock_comments'

  static associations = {
    mock_tasks: { type: 'belongs_to', key: 'task_id' },
  }

  @immutableRelation('mock_tasks', 'task_id')
  task

  @text('body')
  body

  @readonly
  @date('created_at')
  createdAt

  @readonly
  @date('updated_at')
  updatedAt
}

export const modelClasses = [MockProject, MockTask, MockComment]

export const mockDatabase = ({ schema = testSchema, migrations = undefined } = {}) => {
  const adapter = new LokiJSAdapter({
    dbName: 'test',
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  })
  const database = new Database({
    adapter,
    schema,
    modelClasses,
  })
  return {
    database,
    db: database,
    adapter,
    projects: database.get('mock_projects'),
    tasks: database.get('mock_tasks'),
    comments: database.get('mock_comments'),
    cloneDatabase: async (clonedSchema = schema) =>
      // simulate reload
      new Database({
        adapter: await database.adapter.underlyingAdapter.testClone({ schema: clonedSchema }),
        schema: clonedSchema,
        modelClasses,
      }),
  }
}
