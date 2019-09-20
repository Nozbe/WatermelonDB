<p align="center">
  <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/logo-horizontal2.png" alt="WatermelonDB" width="539" />
</p>

<h4 align="center">
  A reactive database framework
</h4>

<p align="center">
  Build powerful React and React Native apps that scale from hundreds to tens of thousands of records and remain <em>fast</em> ⚡️
</p>

<p align="center">
  <a href="https://github.com/Nozbe/WatermelonDB/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License">
  </a>

  <a href="https://travis-ci.com/Nozbe/WatermelonDB">
    <img src="https://api.travis-ci.com/Nozbe/WatermelonDB.svg?branch=master" alt="CI Status">
  </a>

  <a href="https://www.npmjs.com/package/@nozbe/watermelondb">
    <img src="https://img.shields.io/npm/v/@nozbe/watermelondb.svg" alt="npm">
  </a>
</p>

|   | WatermelonDB |
| - | ------------ |
| ⚡️ | **Launch your app instantly** no matter how much data you have |
| 📈 | **Highly scalable** from hundreds to tens of thousands of records |
| 😎 | **Lazy loaded**. Only load data when you need it |
| ✨ | **Reactive** API with [RxJS](https://github.com/ReactiveX/rxjs) |
| 📱 | **Multiplatform**. iOS, Android, and the web |
| ⚛️ | **Made for React.** Easily plug data into components |
| ⏱ | Fast. Async. Multi-threaded. Highly cached. |
| 🔗 | Relational. Built on rock-solid [SQLite](https://www.sqlite.org) foundation |
| ⚠️ | **Static typing** with [Flow](https://flow.org) or [TypeScript](https://typescriptlang.org) |
| 🔄 | **Offline-first.** [Sync](docs/Advanced/Sync.md) with your own backend |

## Why Watermelon?

**WatermelonDB** is a new way of dealing with user data in React Native and React web apps.

It's optimized for building **complex applications** in React Native, and the number one goal is **real-world performance**. In simple words, _your app must launch fast_.

For simple apps, using Redux or MobX with a persistence adapter is the easiest way to go. But when you start scaling to thousands or tens of thousands of database records, your app will now be slow to launch (especially on slower Android devices). Loading a full database into JavaScript is expensive!

Watermelon fixes it **by being lazy**. Nothing is loaded unless requested. And since all querying is performed directly on the rock-solid [SQLite database](https://www.sqlite.org/index.html) on a separate native thread, most queries resolve in an instant.

But unlike using SQLite directly, Watermelon is **fully observable**. So whenever you change a record, all UI that depends on it will automatically re-render. For example, completing a task in a to-do app will re-render the task component, the list (to reorder), and all relevant task counters. [**Learn more**](https://www.youtube.com/watch?v=UlZ1QnFF4Cw).

| <a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-talk-thumbnail.jpg" alt="React Native EU: Next-generation React Databases" width="300" /></a> | <a href="https://github.com/Nozbe/WatermelonDB/blob/master/docs/Demo.md"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-demo-thumbnail.png" alt="WatermelonDB Demo" width="300" /></a> |
| ---- | --- |
| <p align="center"><a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw">📺 <strong>Next-generation React databases</strong><br>(a talk about WatermelonDB)</a></p> | <p align="center"><a href="https://nozbe.github.io/WatermelonDB/Demo.html">✨ <strong>Check out the Demo</strong></a></p> |

## Usage

**Quick (over-simplified) example:** an app with posts and comments.

First, you define Models:

```js
class Post extends Model {
  @field('name') name
  @field('body') body
  @children('comments') comments
}

class Comment extends Model {
  @field('body') body
  @field('author') author
}
```

Then, you connect components to the data:

```js
const Comment = ({ comment }) => (
  <View style={styles.commentBox}>
    <Text>{comment.body} — by {comment.author}</Text>
  </View>
)

// This is how you make your app reactive! ✨
const enhance = withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe()
}))
const EnhancedComment = enhance(Comment)
```

And now you can render the whole Post:

```js
const Post = ({ post, comments }) => (
  <View>
    <Text>{post.name}</Text>
    <Text>Comments:</Text>
    {comments.map(comment =>
      <Comment key={comment.id} comment={comment} />
    )}
  </View>
)

const enhance = withObservables(['post'], ({ post }) => ({
  post,
  comments: post.comments
}))
```

The result is fully reactive! Whenever a post or comment is added, changed, or removed, the right components **will automatically re-render** on screen. Doesn't matter if a change occurred in a totally different part of the app, it all just works out of the box!

### ➡️ **Learn more:** [see full documentation](https://nozbe.github.io/WatermelonDB/)

## Who uses WatermelonDB

  <a href="https://nozbe4.com">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/nozbe4.png" alt="Nozbe 4" width="300" />
  </a>

  <br>

  <a href="https://capmo.de">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/capmo.png" alt="CAPMO" width="300" />
  </a>

  <br>

  <a href="https://steady.health">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/steady.png" alt="Steady" width="150">
  </a>

  <br>

  <a href="https://aerobotics.com">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/aerobotics.png" alt="Aerobotics" width="300" />
  </a>

  <br>

  <a href="https://smashappz.com">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/smashappz.jpg" alt="Smash Appz" width="300" />
  </a>

  <br>

  <a href="https://rocket.chat/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/rocketchat.png" alt="Rocket Chat" width="300" />
  </a>

  <br>

_Does your company or app use 🍉? Open a pull request and add your logo/icon with link here!_

## Contributing

<img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/needyou.jpg" alt="We need you" width="220" />

**WatermelonDB is an open-source project and it needs your help to thrive!**

If there's a missing feature, a bug, or other improvement you'd like, we encourage you to contribute! Feel free to open an issue to get some guidance and see [Contributing guide](./CONTRIBUTING.md) for details about project setup, testing, etc.

If you're just getting started, see [good first issues](https://github.com/Nozbe/WatermelonDB/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) that are easy to contribute to. If you make a non-trivial contribution, email me, and I'll send you a nice 🍉 sticker!

If you make or are considering making an app using WatermelonDB, please let us know!

## Author and license

**WatermelonDB** was created by [@Nozbe](https://github.com/Nozbe). Main author and maintainer is [Radek Pietruszewski](https://github.com/radex).

**Contributors:** [@mobily](https://github.com/mobily), [@kokusGr](https://github.com/kokusGr), [@rozPierog](https://github.com/rozPierog), [@rkrajewski](https://github.com/rkrajewski), [@domeknn](https://github.com/domeknn), [@Tereszkiewicz](https://github.com/Tereszkiewicz) and [more](https://github.com/Nozbe/WatermelonDB/graphs/contributors).

WatermelonDB is available under the MIT license. See the [LICENSE file](./LICENSE) for more info.
