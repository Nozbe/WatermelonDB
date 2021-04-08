import {Model} from '@nozbe/watermelondb';
import {field, relation} from '@nozbe/watermelondb/decorators';

export class Comment extends Model {
  static table = 'comments';

  static associations = {
    posts: {type: 'belongs_to', key: 'post_id'},
  };

  @field('body')
  body;

  @field('is_nasty')
  isNasty;

  @relation('posts', 'post_id')
  post;
}
