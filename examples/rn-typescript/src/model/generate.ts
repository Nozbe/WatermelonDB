import { times } from 'rambdax';
import { blogNames, postNames, postBody, commentBodies } from './randomData';
import { Database } from '@nozbe/watermelondb';
import { Blog } from './Blog.model';
import { Post } from './Post.model';
import { Comment } from './Comment.model';

type Model = Blog | Post | Comment

function flatMap<T, U>(callbackfn: (value: T) => U[], array: T[]): U[] {
  return Array.prototype.concat(...array.map((t) => callbackfn(t)));
}

const fuzzCount = (count: number) => {
  // makes the number randomly a little larger or smaller for fake data to seem more realistic
  const maxFuzz = 4;
  const fuzz = Math.round((Math.random() - 0.5) * maxFuzz * 2);
  return count + fuzz;
};

const makeBlog = (db: Database, i: number) =>
  db.collections.get<Blog>('blogs').prepareCreate((blog: Blog) => {
    blog.name = blogNames[i] || blog.id;
  });

const makePost = (db: Database, blog: Blog, i: number) =>
  db.collections.get<Post>('posts').prepareCreate((post: Post) => {
    post.title = postNames[i] || post.id;
    post.subtitle = `ID: ${post.id}`;
    post.body = postBody;
    post.blog.set(blog);
  });

const makePosts = (db: Database, blog: Blog, count: number): Post[] => times((i) => makePost(db, blog, i), count);

const makeComment = (db: Database, post: Post, i: number) =>
  db.collections.get<Comment>('comments').prepareCreate((comment: Comment) => {
    comment.body = commentBodies[i] || `Comment#${comment.id}`;
    comment.post.set(post);
    comment.isNasty = Math.random() < 0.25; // People can be not nice on the internet
  });

const makeComments = (db: Database, post: Post, count: number): Comment[] => times((i) => makeComment(db, post, i), count);

const generate = (db: Database, blogCount: number, postsPerBlog: number, commentsPerPost: number) =>
  db.write(async (action) => {
    const blogs = times((i) => makeBlog(db, i), blogCount);
    const posts: Post[] = flatMap((blog: Blog) => makePosts(db, blog, fuzzCount(postsPerBlog)), blogs);
    const comments = flatMap((post: Post) => makeComments(db, post, fuzzCount(commentsPerPost)), posts);

    const allRecords = [...blogs, ...posts, ...comments];
    await db.batch(...allRecords);

    return allRecords.length;
  });

export async function generate100(database: Database) {
  return generate(database, 2, 10, 5);
}

export async function generate10k(database: Database) {
  return generate(database, 20, 20, 25);
}
