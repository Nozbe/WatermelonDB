# 架构（Architecture）

## 基础对象

`Database` 是 Watermelon 的根对象。它包含：
- 一个 `DatabaseAdapter`（数据库适配器）
- 一个 `Collection`（集合）映射

`DatabaseAdapter` 将 Watermelon 的响应式世界与底层数据库的命令式世界连接起来。请参阅 [适配器](./DatabaseAdapters.md)。

`Collection` 管理给定类型的所有记录：
- 它有一个从数据库中已获取记录的缓存（`RecordCache`）
- 它提供了用于 `find`（查找）、`query`（查询）和 `create`（创建）现有记录的公共 API
- 它实现了对记录的获取、更新和删除操作

`Model` 是集合记录的一个实例。一个模型 _类_ 描述了一种记录 _类型_。`Model` 是你具体模型（例如 `Post`、`Comment`、`Task`）的基类：
- 它描述了特定实例 —— `id` 以及所有自定义字段和操作
- 它提供了用于 `update`（更新）、`markAsDeleted`（标记为已删除）和 `destroyPermanently`（永久销毁）的公共 API
- 实现了记录级别的观察 `observe()`
- 静态字段描述了模型的基本信息（`table`、`associations`）—— 请参阅 [定义模型](../Model.md)

一般来说，`Model` 管理特定实例的状态，而 `Collection` 管理整个记录集合的状态。例如，`model.markAsDeleted()` 会更改被调用记录的本地状态，但随后会委托给其所属集合来通知集合观察者并实际从数据库中移除该记录。

`Query` 是一个辅助对象，它为我们提供了一个方便的 API 来执行查询（`query.observe()`、`query.fetchCount()`）：
- 通过 `collection.query()` 创建
- 封装了一个 `QueryDescription` 结构，该结构实际描述了查询条件
- `fetch`（获取）/`observe`（观察）方法实际上会委托给 `Collection` 来执行数据库操作
- 缓存由 `observe/observeCount` 方法创建的 `Observable`（可观察对象），以便可以重用和共享

## 辅助函数

Watermelon 的对象和类旨在尽可能简洁 —— 仅管理自身状态并为你的应用提供 API。大多数逻辑应该是无状态的，并以纯函数的形式实现：

`QueryDescription` 是一个描述查询的结构（对象），使用 `Q.*` 辅助函数构建。

`encodeMatcher()`、`simpleObserver()`、`reloadingObserver()`、`fieldObserver()` 实现了查询观察逻辑。

模型装饰器将简单的类属性转换为 Watermelon 感知的记录字段。

适配器的大部分逻辑也以纯函数的形式实现。请参阅 [适配器](./DatabaseAdapters.md)。
