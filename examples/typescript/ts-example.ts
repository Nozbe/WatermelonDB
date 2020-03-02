// tslint:disable: max-classes-per-file
import { Model, Q, Query, Relation } from '@nozbe/watermelondb'
import { action, children, field, lazy, relation } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb/Model';

// Create an enum for all Table Names.
// This will help in documenting where all exact table names need to be passed.
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
