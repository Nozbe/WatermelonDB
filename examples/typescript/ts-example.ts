// tslint:disable: max-classes-per-file
import { Model, Q, Query, Relation } from '@nozbe/watermelondb'
import { action, children, field, lazy, relation } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb/Model'
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'

// Create an enum for all Table Names.
// This will help in documenting where all exact table names need to be passed.
// eslint-disable-next-line no-shadow
enum TableName {
  BLOGS = 'blogs',
  POSTS = 'posts',
}

class Blog extends Model {
  static table = TableName.BLOGS

  static associations: Associations = {
    [TableName.POSTS]: { type: 'has_many', foreignKey: 'blog_id' },
  }

  @field('name') name!: string;

  // eslint-disable-next-line no-use-before-define
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
