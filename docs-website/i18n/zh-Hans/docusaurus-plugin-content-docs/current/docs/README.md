---
title: Check out the README
hide_title: true
---

<p align="center">
  <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/logo-horizontal2.png" alt="WatermelonDB" width="539" />
</p>

<h4 align="center">
  响应式的数据库框架
</h4>

<p align="center">
  构建强大的 React 和 React Native 应用程序，可处理从数百条到数万条记录，并且保持<em>快速</em> ⚡️
</p>

<p align="center">
  <a href="https://github.com/Nozbe/WatermelonDB/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT 许可证"/>
  </a>

  <a href="https://www.npmjs.com/package/@nozbe/watermelondb">
    <img src="https://img.shields.io/npm/v/@nozbe/watermelondb.svg" alt="npm"/>
  </a>
</p>

|   | WatermelonDB |
| - | ------------ |
| ⚡️ | **立即启动应用程序**，无论你有多少数据 |
| 📈 | **高度可扩展**，从数百条到数万条记录 |
| 😎 | **懒加载**。仅在需要时加载数据 |
| 🔄 | **离线优先**。[与你自己的后端同步](https://watermelondb.dev/docs/Sync/Intro) |
| 📱 | **多平台支持**。iOS、Android、Windows、Web 和 Node.js |
| ⚛️ | **针对 React 优化**。轻松将数据插入组件 |
| 🧰 | **与框架无关**。使用 JS API 插入其他 UI 框架 |
| ⏱ | **快速**。并且每次发布都在变得更快！ |
| ✅ | **经过验证**。自 2017 年以来为 [Nozbe Teams](https://nozbe.com/teams) 提供支持（以及 [许多其他应用](#who-uses-watermelondb)） |
| ✨ | **响应式**。（可选）[RxJS](https://github.com/ReactiveX/rxjs) API |
| 🔗 | **关系型**。基于坚如磐石的 [SQLite](https://www.sqlite.org) 基础构建 |
| ⚠️ | **静态类型检查**。可使用 [Flow](https://flow.org) 或 [TypeScript](https://typescriptlang.org) |

## 为什么选择 Watermelon？

**WatermelonDB** 是一种在 React Native 和 React Web 应用程序中处理用户数据的新方式。

它针对在 React Native 中构建 **复杂应用程序** 进行了优化，首要目标是 **实际性能**。简单来说，_你的应用程序必须快速启动_。

对于简单的应用程序，使用 Redux 或 MobX 并搭配持久化适配器是最简单的方法。但当你开始扩展到数千条或数万条数据库记录时，你的应用程序启动会变慢（特别是在较慢的 Android 设备上）。将整个数据库加载到 JavaScript 中成本很高！

Watermelon 通过 **懒加载** 解决了这个问题。在请求数据之前，不会加载任何数据。而且由于所有查询都是在单独的原生线程上直接在坚如磐石的 [SQLite 数据库](https://www.sqlite.org/index.html) 上执行的，大多数查询可以立即解决。

但与直接使用 SQLite 不同，Watermelon 是 **完全可观察的**。因此，每当你更改一条记录时，所有依赖于它的 UI 都会自动重新渲染。例如，在待办应用程序中完成一项任务将重新渲染任务组件、列表（重新排序）以及所有相关的任务计数器。[**了解更多**](https://www.youtube.com/watch?v=UlZ1QnFF4Cw)。


| <a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-talk-thumbnail.jpg" alt="React Native EU: Next-generation React Databases" width="300" /></a> |
| ---- |
| <p align="center"><a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw">📺 <strong>Next-generation React databases</strong><br/>(a talk about WatermelonDB)</a></p> |

## 使用方法

**快速（简化的）示例**：一个包含文章和评论的应用。

首先，你需要定义模型（Models）：

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

然后，你将组件与数据进行连接：

```js
const Comment = ({ comment }) => (
  <View style={styles.commentBox}>
    <Text>{comment.body} — by {comment.author}</Text>
  </View>
)

// 这就是让你的应用具备响应式能力的方法！✨
const enhance = withObservables(['comment'], ({ comment }) => ({
  comment,
}))
const EnhancedComment = enhance(Comment)
```

现在，你可以渲染整个文章：

```js
const Post = ({ post, comments }) => (
  <View>
    <Text>{post.name}</Text>
    <Text>评论:</Text>
    {comments.map(comment =>
      <EnhancedComment key={comment.id} comment={comment} />
    )}
  </View>
)

const enhance = withObservables(['post'], ({ post }) => ({
  post,
  comments: post.comments
}))
```

结果是完全响应式的！每当添加、更改或删除文章或评论时，相应的组件**将自动在屏幕上重新渲染**。无论更改发生在应用的哪个完全不同的部分，一切都能开箱即用！

### ➡️ **了解更多**：[查看完整文档](https://nozbe.github.io/WatermelonDB/)

## Who uses WatermelonDB

  <a href="https://nozbe.com/teams/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/nozbe-teams.png" alt="Nozbe Teams" width="300" />
  </a>

  <br/>

  <a href="https://capmo.de">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/capmo.png" alt="CAPMO" width="300" />
  </a>

  <br/>

  <a href="https://mattermost.com/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/mattermost.png" alt="Mattermost" width="300" />
  </a>

  <br/>

  <a href="https://rocket.chat/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/rocketchat.png" alt="Rocket Chat" width="300" />
  </a>

  <br/>

  <a href="https://steady.health">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/steady.png" alt="Steady" width="150"/>
  </a>

  <br/>

  <a href="https://aerobotics.com">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/aerobotics.png" alt="Aerobotics" width="300" />
  </a>

  <br/>

  <a href="https://smashappz.com">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/smashappz.jpg" alt="Smash Appz" width="300" />
  </a>

  <br/>

  <a href="https://halogo.com.au/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/halogo_logo.png" alt="HaloGo" width="300" />
  </a>

  <br/>

  <a href="https://sportsrecruits.com/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/sportsrecruits-logo.png" alt="SportsRecruits" width="300" />
  </a>

  <br/>

  <a href="https://chatable.io/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/chatable_logo.png" alt="Chatable" width="300" />
  </a>

  <br/>

  <a href="https://todorant.com/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/todorant-logo.png" alt="Todorant" width="300" />
  </a>

  <br/>

  <a href="https://blastworkout.app/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/blastworkout-logo.png" alt="Blast Workout" width="300" />
  </a>

  <br/>

  <a href="https://dayful.app/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/dayful.png" alt="Dayful" width="300" />
  </a>

  <br/>

  <a href="https://learnthewords.app/">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/apps/learn-the-words.png" alt="Learn The Words" width="300" />
  </a>

  <br/>

_贵公司或应用是否使用了 🍉 WatermelonDB？请发起一个拉取请求，在此处添加带有链接的公司标志或应用图标！_

## 贡献代码

<img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/needyou.jpg" alt="我们需要你" width="220" />

**WatermelonDB 是一个开源项目，它的蓬勃发展需要你的帮助！**

如果你发现缺少某个功能、存在 bug 或有其他改进建议，我们鼓励你贡献代码！你可以随时创建一个问题以获取指导，并查看 [贡献指南](./CONTRIBUTING.md) 了解项目设置、测试等详细信息。

如果你刚刚开始参与，可查看[适合新手的问题](https://github.com/Nozbe/WatermelonDB/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)，这些问题易于贡献。如果你做出了重要贡献，请发邮件给我，我会送你一张漂亮的 🍉 贴纸！

如果你正在使用或考虑使用 WatermelonDB 开发应用，请告知我们！

## 作者与许可证

**WatermelonDB** 由 [@Nozbe](https://github.com/Nozbe) 创建。

**WatermelonDB** 的主要作者和维护者是 [Radek Pietruszewski](https://github.com/radex) ([个人网站](https://radex.io) ⋅ [𝕏 (Twitter)](https://twitter.com/radexp))

[查看所有贡献者](https://github.com/Nozbe/WatermelonDB/graphs/contributors)。

WatermelonDB 采用 MIT 许可证。更多信息请查看[许可证文件](https://github.com/Nozbe/WatermelonDB/LICENSE)。
