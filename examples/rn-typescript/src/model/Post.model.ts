import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, relation, children, writer } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { Blog } from './Blog.model';
import { Comment } from './Comment.model';

export class Post extends Model {
  static table = 'posts';

  static associations: Associations = {
    blogs: { type: 'belongs_to', key: 'blog_id' },
    comments: { type: 'has_many', foreignKey: 'post_id' },
  };

  @field('title') title!: string;

  @field('subtitle') subtitle!: string;

  @field('body') body!: string;

  @relation('blogs', 'blog_id') blog!: Relation<Blog>;

  @children('comments') comments!: Query<Comment>;

  @writer async addComment(body: string) {
    return this.collections.get<Comment>('comments').create((comment) => {
      comment.post.set(this);
      comment.body = body;
    });
  }
}
