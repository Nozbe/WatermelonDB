---
title: 前端
hide_title: true
---

## 在前端实现同步

### 在应用中使用 `synchronize()`

要进行同步，你需要传入 `pullChanges` 和 `pushChanges`（可选），它们用于与你的后端进行通信，并且要与 Watermelon Sync 协议兼容。前端代码大致如下：

```js
import { synchronize } from '@nozbe/watermelondb/sync'

async function mySync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const urlParams = `last_pulled_at=${lastPulledAt}&schema_version=${schemaVersion}&migration=${encodeURIComponent(
        JSON.stringify(migration),
      )}`
      const response = await fetch(`https://my.backend/sync?${urlParams}`)
      if (!response.ok) {
        throw new Error(await response.text())
      }

      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`https://my.backend/sync?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        body: JSON.stringify(changes),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
    },
    migrationsEnabledAtVersion: 1,
  })
}
```

### 谁调用 `synchronize()` 方法？

看到上面的示例后，可能会产生一个问题：谁来调用 `synchronize()` 方法，或者在上面的示例中，谁来调用 `mySync()` 方法？WatermelonDB 不会以任何方式管理 `synchronize()` 函数的调用时机。数据库假定每次调用 `pullChanges` 都会返回 _所有_ 尚未复制的更改（截至 `last_pulled_at`）。应用程序代码负责按照其认为必要的频率调用 `synchronize()`。

### 实现 `pullChanges()`

Watermelon 会调用此函数，以获取自上次拉取以来服务器上发生的更改。

参数：
- `lastPulledAt`：客户端上次从服务器拉取更改的时间戳（如果是首次同步，则为 `null`）
- `schemaVersion`：本地数据库的当前架构版本
- `migration`：一个对象，表示自上次同步以来的架构更改（如果是最新版本或不支持，则为 `null`）

此函数应从服务器获取自 `lastPulledAt` 以来所有集合中的 _所有_ 更改列表。

1. 你 **必须** 传入一个异步函数，或者返回一个最终会解决或拒绝的 Promise。
2. 你 **必须** 将 `lastPulledAt`、`schemaVersion` 和 `migration` 传递给符合 Watermelon Sync 协议的端点。
3. 你 **必须** 返回一个 Promise，该 Promise 解析为以下格式的对象（你的后端**应该**已经返回此格式）：
   ```js
   {
     changes: { ... }, // 有效的更改对象
     timestamp: 100000, // 整数，表示 *服务器* 的当前时间
   }
   ```
4. 你 **绝不能** 存储 `pullChanges()` 中返回的对象。如果你需要对其进行任何处理，请在返回对象之前完成。Watermelon 将此对象视为“一次性使用”，并且可能会对其进行修改（出于性能原因）。

### 实现 `pushChanges()`

Watermelon 会调用此函数，并传入自上次推送以来本地发生的更改列表，以便你可以将其发送到后端。

传入的参数：
```js
{
  changes: { ... }, // 有效的更改对象
  lastPulledAt: 10000, // 上次成功拉取的时间戳（`pullChanges` 中返回的时间戳）
}
```

1. 你 **必须** 将 `changes` 和 `lastPulledAt` 传递给符合 Watermelon Sync 协议的推送同步端点。
2. 你 **必须** 从 `pushChanges()` 传入一个异步函数或返回一个 Promise。
3. `pushChanges()` **必须** 在后端确认已成功接收本地更改之后才解析。
4. 如果后端未能应用本地更改，`pushChanges()` **必须** 拒绝。
5. 你 **绝不能** 在后端失败或未完成时过早地解析同步操作。
6. 你 **绝不能** 修改或存储传递给 `pushChanges()` 的参数。如果你需要对其进行任何处理，请在返回对象之前完成。Watermelon 将此对象视为“一次性使用”，并且可能会对其进行修改（出于性能原因）。

## 检查未同步的更改

WatermelonDB 内置了一个函数，用于检查是否存在未同步的更改。前端代码大致如下：

```js
import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync'

async function checkUnsyncedChanges() {
  const database = useDatabase()
  await hasUnsyncedChanges({ database })
}
```

## 一般信息和提示

1. 你 **绝不能** 使用 `synchronize()` 连接到你无法控制的后端端点。WatermelonDB 假定 `pullChanges`/`pushChanges` 是可靠且正确的，如果返回的数据格式错误，它不保证安全的行为。
2. 你 **不应该** 在同步操作已经进行时调用 `synchronize()`（该调用会安全地中止）。
3. 你 **绝不能** 在同步操作进行时重置本地数据库（推送到服务器的操作会安全地中止，但本地数据库的一致性可能会受到影响）。
4. 你 **应该** 将 `synchronize()` 包裹在一个“重试一次”的代码块中 —— 如果同步失败，再尝试一次。这样可以通过在推送之前再次拉取来解决由于服务器端冲突导致的推送失败问题。
5. 你可以使用 `database.withChangesForTables` 来检测本地更改何时发生，从而调用同步操作。如果你这样做，应该对这个信号进行去抖动（或节流）处理，以避免过于频繁地调用 `synchronize()`。

## 采用迁移同步

为了让 Watermelon Sync 在 [迁移](../Advanced/Migrations.md) 之后保持一致性，你必须支持迁移同步（在 WatermelonDB v0.17 中引入）。这允许 Watermelon 从后端请求它所需的表和列，以获取所有数据。

1. 对于新应用，将 `{migrationsEnabledAtVersion: 1}` 传递给 `synchronize()`（或者传递第一个发布的架构版本 / 可以迁移到当前版本的最旧架构版本）。
2. 要启用迁移同步，数据库 **必须** 使用 [迁移规范](../Advanced/Migrations.md) 进行配置（即使它为空）。
3. 对于现有应用，在进行任何架构更改之前，将 `migrationsEnabledAtVersion` 设置为当前架构版本。换句话说，这个版本应该是支持迁移同步的第一次迁移之前的最后一个架构版本。
4. 请注意，对于在 WatermelonDB v0.17 之前发布的应用，无法确定同步发生时的最后一个架构版本。在这种情况下，`migrationsEnabledAtVersion` 用作占位符。无法保证会请求所有必要的表和列。（如果用户在架构版本低于 `migrationsEnabledAtVersion` 时登录，后来添加了表或列，并且在用户更新到支持这些表和列的应用版本之前，服务器上这些表中产生了新记录或这些列发生了更改，那么这些记录将不会同步）。为了解决这个问题，你可以将 `migrationsEnabledAtVersion` 指定为可以迁移到当前版本的最旧架构版本。但是，这意味着用户在更新到支持迁移同步的应用版本后，将从服务器请求新表中的所有记录。这可能会导致效率极低。
5. WatermelonDB >=0.17 会记录用户登录时的架构版本，即使未启用迁移，应用也可以从后端请求低于 `migrationsEnabledAtVersion` 的架构版本的更改。
6. 你 **绝不能** 删除旧的 [迁移](../Advanced/Migrations.md)，否则应用可能会永久无法同步。

## （高级）采用 Turbo 登录

WatermelonDB v0.23 引入了一种名为“Turbo 登录”的高级优化功能。使用 Turbo 进行同步比传统方法快达 5.3 倍，并且占用的内存也少得多，因此即使对于非常大的同步操作也很适用。请记住：

1. 此功能仅适用于初始（登录）同步，不适用于增量同步。如果数据库不为空却以 Turbo 模式运行同步，这是严重的编程错误。
2. 带有非空 `deleted: []` 字段的同步将会失败。
3. Turbo 仅适用于启用并运行 JSI 的 SQLiteAdapter，在 Web 环境中或启用 Chrome 远程调试等情况下无法使用。
4. 虽然 Turbo 登录功能稳定，但它被标记为“不安全”，这意味着在未来版本中，其确切的 API 可能会发生变化。

以下是基本用法：

```js
const isFirstSync = ...
const useTurbo = isFirstSync
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    const response = await fetch(`https://my.backend/sync?${...}`)
    if (!response.ok) {
      throw new Error(await response.text())
    }

    if (useTurbo) {
      // 注意：不要解析 JSON，我们需要原始文本
      const json = await response.text()
      return { syncJson: json }
    } else {
      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    }
  },
  unsafeTurbo: useTurbo,
  // ...
})
```

需要原始的 JSON 文本，因此不建议在 `pullChanges()` 中进行任何处理，因为这样做会大大降低使用 Turbo 登录的意义！

如果你使用 `pullChanges` 向应用发送除 Watermelon Sync 的 `changes` 和 `timestamp` 之外的其他数据，你将无法在 `pullChanges` 中处理这些数据。不过，WatermelonDB 仍然可以将同步响应中的额外键传递回应用，你可以使用 `onDidPullChanges` 来处理这些数据。这在 Turbo 模式和非 Turbo 模式下都适用：

```js
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    // ...
  },
  unsafeTurbo: useTurbo,
  onDidPullChanges: async ({ messages }) => {
    if (messages) {
      messages.forEach((message) => {
        alert(message)
      })
    }
  },
  // ...
})
```

还有一种方法可以让 Turbo 登录变得更快！不过，这需要具备原生开发技能。你需要开发自己的原生网络代码，这样原始 JSON 就可以直接从你的原生代码传递到 WatermelonDB 的原生代码，完全跳过 JavaScript 处理过程。

```js
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    // 注意：增量同步需要标准的 JS 代码路径

    // 为此次同步请求创建一个唯一 ID
    const syncId = Math.floor(Math.random() * 1000000000)

    await NativeModules.MyNetworkingPlugin.pullSyncChanges(
      // 传递 ID
      syncId,
      // 传递你的插件进行请求所需的任何信息
      lastPulledAt,
      schemaVersion,
      migration,
    )

    // 如果成功，返回同步 ID
    return { syncJsonId: syncId }
  },
  unsafeTurbo: true,
  // ...
})
```

在原生代码中，执行网络请求，若成功则提取原始响应体数据 —— 在 iOS 上是 `NSData *`，在 Android 上是 `byte[]`。避免将响应提取为字符串或解析 JSON。然后将其传递给 WatermelonDB 的原生代码：

```java
// 在 Android (Java) 上：
import com.nozbe.watermelondb.jsi.WatermelonJSI;

WatermelonJSI.provideSyncJson(/* ID */ syncId, /* byte[] */ data);
```

```objc
// 在 iOS (Objective-C) 上：
// (如果使用 Swift，将导入语句添加到桥接头文件中)
#import <WatermelonDB/WatermelonDB.h>

watermelondbProvideSyncJson(syncId, data, &error)
```

## 为同步过程添加日志记录

你可以通过向 `synchronize()` 传递一个空对象，为同步过程添加基本的同步日志。同步过程会修改这个对象，填充诊断信息（开始/结束时间、已解决的冲突、远程/本地更改的数量、发生的任何错误等等）：

```js
// 使用内置的 SyncLogger
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger'
const logger = new SyncLogger(10 /* 内存中保留的同步日志数量限制 */ )
await synchronize({ database, log: logger.newLog(), ... })

// 这会返回所有日志（经过审查，可安全用于生产代码）
console.log(logger.logs)
// 同样的日志，但格式化为易读的字符串（用户可以轻松复制用于诊断）
console.log(logger.formattedLogs)


// 你不必使用 SyncLogger，只需向 synchronize() 传递一个普通对象即可
const log = {}
await synchronize({ database, log, ... })
console.log(log.startedAt)
console.log(log.finishedAt)
```

⚠️ 请记住，要谨慎处理日志，因为它们可能包含用户的私人信息。在对日志进行审查之前，不要显示、保存或发送日志。

## 调试 `changes`

如果你想在控制台方便地查看同步过程中的传入和传出更改，可以在 `pullChanges` 或 `pushChanges` 中添加以下代码行：

⚠️ 在生产环境中提交并运行此类日志记录代码会带来严重的安全漏洞，并且会影响性能。

```js
// 无！论！如！何！，你都不应该提交未注释的这些代码行！！！
require('@nozbe/watermelondb/sync/debugPrintChanges').default(changes, isPush)
```

如果你要检查传出更改（`pushChanges`），则将第二个参数设置为 `true`，否则设置为 `false`。务必确保不要提交这个调试工具。为了获得最佳体验，建议在 Web（Chrome）上运行此代码 —— React Native 环境下的体验没有那么好。

## （高级）替换同步

WatermelonDB 0.25 版本引入了一种与服务器同步更改的替代方法，称为“替换同步”。由于性能方面的影响，你应该仅在难以通过增量方式处理的情况下将其作为最后手段使用。

通常情况下，`pullChanges` 只应返回自 `lastPulledAt` 以来发生的数据更改。在替换同步期间，服务器会发送完整的数据集 —— 用户有权限访问的 _所有_ 记录，这与初始（首次/登录）同步时的情况相同。

应用不会像往常一样应用这些更改，而是会用接收到的数据集替换其数据库，但会保留本地未推送的更改。换句话说：
- 应用会创建本地新增的记录，并像往常一样将其余记录更新为服务器端的状态。
- 本地有未推送更改的记录将像往常一样进行冲突解决。
- 但是，服务器不会传递要删除的记录列表，应用会删除接收到的数据集中不存在的本地记录。
- 关于如何保留未推送更改的详细信息：
    - 标记为 `created` 的记录会被保留，以便有机会进行同步。
    - 标记为 `updated` 或 `deleted` 的记录，如果包含在接收到的数据集中，则会被保留；否则，会被删除（因为这些记录已在远程被删除，或者服务器不再允许你访问它们，即使推送这些更改也会被忽略）。

如果在同步之前或期间没有本地（未推送）更改，替换同步应该会产生与清空数据库并执行初始同步相同的状态。如果使用空数据集执行替换同步（并且没有本地更改），结果应该等同于清空数据库。

**何时应该使用替换同步？**

- 你可以使用它来修复错误的同步状态（本地和远程状态不匹配）。
- 当你有非常大的状态变更，并且你的服务器不知道如何正确计算自上次同步以来的增量变更时（例如，在一个非常复杂的权限系统中，可访问的记录发生了变化），你可以使用它。

在这种情况下，你也可以选择重新登录（清空数据库，然后再次执行初始同步），然而：

- 替换同步会保留对记录的本地更改（以及其他状态，如本地存储），因此数据丢失的风险极小。
- 清空数据库时，你需要放弃对 Watermelon 对象的所有引用，并停止所有观察。因此，你需要卸载所有与 Watermelon 交互的 UI，这会导致糟糕的用户体验。而替换同步则不需要这样做。
- 另一方面，替换同步比 Turbo 登录慢得多（这两种技术不能结合使用），因此这种技术可能不适用于非常大的数据集。

**使用替换同步**

在 `pullChanges` 中，返回一个带有额外 `strategy` 字段的对象：

```js
{
  changes: { ... },
  timestamp: ...,
  experimentalStrategy: 'replacement',
}
```

## `synchronize()` 的其他标志

- `_unsafeBatchPerCollection: boolean` - 如果为 `true`，更改将分多个批次保存到数据库中。这是不安全的，会破坏事务性，但由于内存问题，对于非常大的同步可能是必要的。
- `sendCreatedAsUpdated: boolean` - 如果你的后端无法区分创建和更新的记录，将此设置为 `true` 以抑制警告。同步仍然可以正常工作，但错误报告和一些边缘情况的处理可能会受到影响。
- `conflictResolver: (TableName, local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw) => DirtyRaw` - 可以传递此函数来自定义在同步期间记录发生更改时如何更新记录。详情请参阅 `src/sync/index.js`。
- `onWillApplyRemoteChanges` - 在 `pullChanges` 完成后但在应用这些更改之前调用。作为参数传递一些关于拉取更改的统计信息。高级用户可以使用此功能，例如在处理非常大的同步时向用户显示一些 UI（这对于替换同步可能很有用）。请注意，在 Turbo 模式下，远程更改计数为 `NaN`。


