// tslint:disable: max-classes-per-file
import { Database, Model, Q, Query, Relation } from '@nozbe/watermelondb'
import { action, children, field, lazy, relation, text } from '@nozbe/watermelondb/decorators'
import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import { Associations } from '@nozbe/watermelondb/Model'
import { SyncDatabaseChangeSet, synchronize } from "@nozbe/watermelondb/sync"
import { AppSchema } from "./AppSchema"
// Create an enum for all Table Names.
// This will help in documenting where all exact table names need to be passed.
export enum TableName {
  BLOGS = 'blogs',
  POSTS = 'posts',
}

class Blog extends Model {
  static table = TableName.BLOGS

  static associations: Associations = {
    [TableName.POSTS]: { type: 'has_many', foreignKey: 'blog_id' },
  }

  @field('name') name!: string;

  @children(TableName.POSTS) posts!: Query<Post>;

  @lazy nastyPosts = this.posts
    .extend(Q.where('is_nasty', true));

  @action async moderateAll() {
    await this.nastyPosts.destroyAllPermanently()
  }
}

class Post extends Model {
  static table = TableName.POSTS

  static associations: Associations = {
    [TableName.BLOGS]: { type: 'belongs_to', key: 'blog_id' },
  }

  @field('name') name!: string;
  @text("body") content!: string;
  @field('is_nasty') isNasty!: boolean;

  @relation(TableName.BLOGS, 'blog_id') blog!: Relation<Blog>;
}

// Define a custom ID generator.
function randomString(): string {
  return 'RANDOM STRING'
}

setGenerator(randomString)

// or as anonymous function:
setGenerator(() => 'RANDOM STRING')

const adapter = new SQLiteAdapter({
  schema: AppSchema,
  migrations: schemaMigrations({
    migrations: [
      {
        toVersion: 1,
        steps: [
          addColumns({
            table: TableName.POSTS,
            columns: [{ name: "body", type: "string", isIndexed: true, isOptional: false }],
          }),
        ],
      },
    ],
  }),
  onSetUpError: (error): void => { },
})

const db = new Database({
  adapter,
  modelClasses: [Blog, Post],

})

const sync = async () => {
  return synchronize({
    database: db,
    async pullChanges({ lastPulledAt, schemaVersion, migration }) {
      // just for demo purposes, this should come from the server
      const serverTS = new Date().getTime()
      const serverChanges: SyncDatabaseChangeSet = {
        posts: {
          created: [],
          updated: [],
          deleted: ["some-id"],
        },
      }

      return { changes: serverChanges, timestamp: serverTS }
    },
    async pushChanges({ changes, lastPulledAt }) {
      return undefined
    },
  })
}