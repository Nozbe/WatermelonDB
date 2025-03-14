---
title: 自动创建 / 更新跟踪
hide_title: true
---

### 创建 / 更新跟踪

你可以为每个表添加创建/更新跟踪支持。启用此功能后，模型将包含创建时间和最后更新时间的信息。

:warning: **注意**：如果 `created_at` / `updated_at` 字段存在，WatermelonDB 会自动将其设置并持久化为**毫秒级**时间戳。如果你打算以任何方式与这些属性进行交互，应始终将它们视为毫秒级时间戳。

#### 何时使用此功能

**使用创建跟踪**：
- 当你向用户显示某个事物（例如帖子、评论、任务）的创建时间时。
- 如果你需要按时间顺序对创建的项目进行排序（请注意，记录 ID 是随机字符串，而不是自增整数，因此你需要创建跟踪功能才能按时间顺序排序）。

**使用更新跟踪**：
- 当你向用户显示某个事物（例如帖子）的修改时间时。

**注意事项**：
- 你**不必**同时启用创建跟踪和更新跟踪。你可以选择启用其中一个、两个都启用或都不启用。
- 在你的模型中，这些字段需要分别命名为 `createdAt` 和 `updatedAt`。

#### 如何实现

**步骤 1**：添加到[模式（Schema）](../Schema.md)中：

```js
tableSchema({
  name: 'posts',
  columns: [
    // 其他列
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
}),
```

**步骤 2**：将以下内容添加到模型定义中：

```js
import { date, readonly } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt
}
```

同样，如果你不需要更新跟踪功能，只需添加 `created_at` 列和字段即可。

#### 行为说明

如果你在模型中定义了神奇的 `createdAt` 字段，当你首次调用 `collection.create()` 或 `collection.prepareCreate()` 时，将设置当前时间戳。此后该字段将不会再被修改。

如果还定义了神奇的 `updatedAt` 字段，那么在创建后，`model.updatedAt` 将与 `model.createdAt` 具有相同的值。然后，每次调用 `model.update()` 或 `model.prepareUpdate()` 时，`updatedAt` 将被更改为当前时间戳。
