import { Model, Q, Query } from '@nozbe/watermelondb';
import { field, children, lazy, writer } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { Post } from './Post.model';
import { Comment } from './Comment.model'

export class Blog extends Model {
  static table = 'blogs';

  static associations: Associations = {
    posts: { type: 'has_many', foreignKey: 'blog_id' },
  };

  @field('name') name!: string;

  @children('posts') posts!: Query<Post>;

  @lazy
  nastyComments = this.collections
    .get<Comment>('comments')
    .query(Q.on('posts', 'blog_id', this.id), Q.where('is_nasty', true));

  @writer async moderateAll() {
    await this.nastyComments.destroyAllPermanently();
  }
}
