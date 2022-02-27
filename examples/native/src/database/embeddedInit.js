import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { blogSchema } from '../model/schema';
import { Post } from '../model/Post.model.js';
import { Comment } from '../model/Comment.model';
import { Blog } from '../model/Blog.model';

import embeddedPath from './embeddedPath';

async function initialize() {
  const databasePathAndName = await embeddedPath('WatermelonDemo');
  const adapter = new SQLiteAdapter({
    schema: blogSchema,
    dbName: databasePathAndName, // optional database name or file system path
    // migrations, // optional migrations
    experimentalUseJSI: false,
  });

  const database = new Database({
    adapter,
    modelClasses: [Post, Comment, Blog],
    actionsEnabled: true,
  });

  return database;
}

export default initialize();
