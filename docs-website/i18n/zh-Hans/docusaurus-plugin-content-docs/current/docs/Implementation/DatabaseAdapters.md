# 数据库适配器（Adapters）

在本指南中，你将学习如何为 WatermelonDB 添加对新数据库和新平台的支持。

## 简介

WatermelonDB 被设计为与数据库无关。它是一个前端 JavaScript 数据库框架，但其高级抽象可以接入任何底层数据库、平台或 UI 框架。我们将底层数据库与 WatermelonDB 高级 API 之间的转换层称为**数据库适配器**。

## 当前支持的数据库

### SQLite

支持的框架：

- React Native：
  - 操作系统：
    - iOS
    - Android
  - 实现方式：
    - JSI 适配器
    - 新的 NativeModule（0.26 版本新增）
    - 旧的 NativeModule（0.26 版本已弃用）
- NodeJS
  - 通过 `better-sqlite3` - 由 Sid Ferreira 贡献

### LokiJS

支持的框架：

- Web
  - 存储方式：IndexedDB
- NodeJS
  - 存储方式：仅内存存储

为什么选择 [LokiJS](http://techfort.github.io/LokiJS/)？WebSQL 非常适合 Watermelon，但遗憾的是它是一个已废弃的 API，因此我们必须使用 IndexedDB，但它的查询功能使其不适合作为一个严肃的数据库。LokiJS 实现了一个非常快速的内存查询 API，并使用 IndexedDB 作为存储。

## 贡献这些适配器！

请为 WatermelonDB 做出贡献。我们很乐意支持以下平台和数据库：

- [适用于 Windows 和 macOS 的 React Native](https://microsoft.github.io/react-native-windows/)
- [Realm 数据库](https://github.com/realm/realm-cpp)
- 用于 Web 的 SQLite ([sql.js](https://github.com/sql-js/sql.js/) 或 [absurd-sql](https://github.com/jlongster/absurd-sql))
- LokiJS 的 NodeJS 存储选项
- 用于 [Electron](https://www.electronjs.org)、Tauri 等的 SQLite
- 用于 [Capacitor](https://capacitorjs.com) 的 SQLite

## 添加新的 React Native 操作系统

由于我们的跨平台 JSI（C++）SQLite 适配器，为新的 React Native 平台（如 macOS 或 Windows）添加支持所需的代码非常少。

你只需执行以下操作：

- 编译 `native/shared` 文件夹中的 `.cpp` 文件
- 将库与 `sqlite3` 链接
  - 尽可能使用系统提供的 sqlite3（我们在 iOS 上就是这样做的）
  - 如果没有系统提供的，我们通过 NPM `@nozbe/sqlite` 包提供 sqlite 源代码。只需将 `node_modules/@nozbe/sqlite/**` 添加到搜索路径中，并编译 `node_modules/@nozbe/sqlite/*/sqlite3.c`
- 为 `native/shared/DatabasePlatform.h` 提供实现
  - 请注意，对于基本操作，这些函数中的大多数可以不实现（为空） - 例如，你可以跳过日志记录、内存管理、Turbo JSON 支持
- 提供一个调用 `Database::install(jsi::Runtime *)` 的 React Native 钩子

查看 `native/android-jsi` 和 `native/ios` 以获取两个实现示例。你可能可以复用其中的一些代码，例如平台支持存根或 `CMakeLists.txt`。

## 为 SQLite 适配器添加新框架

假设你想为一个新的 JS+原生框架（如 Electron、Tauri、NativeScript 或 Capacitor）添加支持。

这需要更多的工作，但最终，鉴于已经支持（iOS、Android、JS、C++、Objective-C、Java）（仅适用于 React Native 和 Node），你只需要开发必要的粘合代码，以弥合 `src/adapters/sqlite` JS 代码与非 React Native 特定的原生代码之间的差距。你需要对要支持的平台有一定的了解，但完成这项工作所需的 WatermelonDB/React Native/C++ 知识很少。

### JavaScript 端粘合代码

通用的 SQLite 实现位于 `src/adapters/sqlite/index.js`。它将数据库调用转发给 `this._dispatcher`。调度器就是 JavaScript 端的桥梁/粘合代码。

查看 `src/adapters/sqlite/makeDispatcher` 以了解具体的调度器，并根据平台调用原生代码的约定添加你自己的调度器。例如：

- `makeDispatcher/index.js`（Node JS）只是导入更多的 JavaScript 代码，因为在这种情况下，原生代码就是 JavaScript 代码
- `makeDispatcher/index.native.js`（React Native）调用 `require('react-native').NativeModules`

### 原生端粘合代码

根据你要支持的框架的功能，有几种方法可以实现：

**简单（仅 JavaScript）方法**。如果你的框架在 JavaScript 中已有**同步工作的**现有 SQLite 绑定（类似于 Node 中的 [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)），你可以复用 `src/adapters/sqlite/sqlite-node` 中的代码。

**Java/Objective - C 方法**。如果你的框架针对 iOS、macOS 或 Android，并且你对 C++ 有所顾虑，你可以复用 React Native 的 NativeModule 实现。

  - 查看 `native/ios/WatermelonDB/objc/WMDatabase.{h,m}` 和 `WMDatabaseDriver.{h,m}` 以了解 iOS 实现。这些文件包含 SQLite、WatermelonDB 和 iOS 特定的逻辑，但不包含 React Native 的细节。你需要为你的框架提供一个相当于 `WMDatabaseBridge`（`WMDatabaseDriver` 和 JavaScript 之间的 React Native 粘合代码）的实现。
  - 对于 Android，查看 `native/android/src/main/java/com/nozbe/watermelondb/WMDatabase.java` 和 `WMDatabaseDriver.java`。

**C++ 方法**。最好的方法是重构 React Native 的 C++ JSI 模块，将 React Native 特定的逻辑分离出来，留下一个与框架无关的核心。这样做可以确保你的移植版本能获得对新操作系统的支持以及所有新特性，因为从长远来看，核心的 React Native 模块将专注于 C++ 实现。关于此方面的指导，请联系 @radex。

## 添加新数据库

如果你想为新的底层数据库（即非基于 SQL 或 LokiJS 的数据库）添加支持，以下是大致所需步骤：

- 一个新的 `FoodbAdapter`，它要符合 `DatabaseAdapter`（`src/adapters/type.js`）。为了实现基本支持，你最初可以跳过一些方法的实现，最基本的方法有 `find`、`query`、`count`、`batch`。
- 有某种方法将 WatermelonDB 的查询语言转换为你所使用数据库的特定查询。参考如下：
  - `src/adapters/sqlite/encodeQuery` 用于生成 SQL 查询
  - `src/adapters/lokijs/worker/encodeQuery` 用于生成 LokiJS 查询，以及 `executeQuery` 用于执行连接操作（Loki 原生不支持连接操作）
