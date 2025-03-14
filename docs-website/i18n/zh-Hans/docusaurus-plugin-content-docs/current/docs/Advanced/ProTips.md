---
title: 专业提示
hide_title: true
---

# 各类专业提示

## 数据库查看器

[查看讨论](https://github.com/Nozbe/WatermelonDB/issues/710)

**Android** - 你可以在最新版本的 Android Studio 中使用新的 [应用检查器](https://medium.com/androiddevelopers/database-inspector-9e91aa265316)。

**通过 Flipper** 你也可以使用带有 [插件](https://github.com/panz3r/react-native-flipper-databases#readme) 的 Facebook Flipper。查看 [讨论](https://github.com/Nozbe/WatermelonDB/issues/653)。

**iOS** - 在 iOS 系统日志中查看打开的数据库路径（通过已连接设备的控制台、Xcode 日志，或者 [使用 `find`](https://github.com/Nozbe/WatermelonDB/issues/710#issuecomment-776255654)），然后通过控制台中的 `sqlite3` 打开它，或者使用像 [sqlitebrowser](https://sqlitebrowser.org) 这样的外部工具。

## 我正在使用哪个 SQLite 版本？

通常只有在你使用原生 SQL 来使用新的 SQLite 版本时，这才会有影响：

- 在 iOS 上，我们使用与操作系统捆绑的任何 SQLite 版本。[这里有一个 iOS 版本 - SQLite 版本匹配表](https://github.com/yapstudios/YapDatabase/wiki/SQLite-version-(bundled-with-OS))
- 在 JSI 模式下的安卓上，我们使用与 WatermelonDB 捆绑的 SQLite。查看 `@nozbe/sqlite` NPM 依赖版本以了解捆绑的 SQLite 版本。
- 在非 JSI 模式下的安卓上，我们使用与操作系统捆绑的 SQLite。

顺便说一下：我们很高兴接受贡献，这样你就可以在所有模式和所有平台上选择自定义版本或构建的 SQLite，但这需要手动开启（这会增加构建时间和二进制文件大小，而且大多数人不需要这个功能）。

## 在原生端预填充数据库

目前没有内置的支持。一种方法是生成一个 SQLite 数据库（你可以使用 0.19.0 - 2 预发布版本中的 Node SQLite 支持，或者从 iOS/安卓应用中提取它），将其与应用捆绑，然后在从 JS 端尝试加载数据库之前，使用一些代码检查你期望的数据库是否可用，如果不可用，则复制默认数据库。[查看讨论](https://github.com/Nozbe/WatermelonDB/issues/774#issuecomment-667981361)

## 重写实体 ID 生成器

你可以选择用自己的自定义 ID 生成器重写 WatermelonDB 的 ID 生成器，以创建特定的随机 ID 格式（例如，如果后端使用 UUID）。在你的数据库索引文件中，将带有自定义 ID 生成器的函数传递给 `setGenerator`：

```
// 定义一个自定义 ID 生成器。
function randomString(): string {
  return 'RANDOM STRING';
}
setGenerator(randomString);

// 或者作为匿名函数：
setGenerator(() => 'RANDOM STRING');
```

若要专门获取 UUID，请安装 [uuid](https://github.com/uuidjs/uuid)，然后将其 ID 生成器传递给 `setGenerator`：

```
import { v4 as uuidv4 } from 'uuid';

setGenerator(() => uuidv4());
```
