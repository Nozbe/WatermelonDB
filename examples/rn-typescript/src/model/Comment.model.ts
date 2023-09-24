import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { Post } from './Post.model';

export class Comment extends Model {
  static table = 'comments';

  static associations: Associations = {
    posts: { type: 'belongs_to', key: 'post_id' },
  };

  @field('body') body!: string;

  @field('is_nasty') isNasty!: boolean;

  @relation('posts', 'post_id') post!: Relation<Post>;
}
