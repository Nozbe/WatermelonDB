# 日志记录（Logging）

默认情况下，Watermelon 启用了基本的日志记录功能，这对于调试可能很有用。当应用程序启动时，会记录有关数据库位置和设置的基本信息。每次执行查询时，都会记录时间信息。

## 禁用日志记录

禁用所有日志记录很简单。在应用程序启动之前，通常在 `database.js` 文件中，导入日志记录器并将其静音：

```js
import logger from '@nozbe/watermelondb/utils/common/logger';
logger.silence();
```

## 重写日志记录行为

> **注意**：这个类尚未正式文档化，其规范可能会发生变化。此方法仅适用于高级用户，他们需要对未来可能出现的重大变更有一定的容忍度。

日志记录器是 `Logger` 类的单例实例，它公开了三个方法：`log()`、`warn()` 和 `error()`。高级用户可以通过猴子补丁（monkey-patch）日志记录器的方法来更改其行为，例如将消息路由到另一个日志记录器：

```js
import Cabin from 'cabin';
import logger from '@nozbe/watermelondb/utils/common/logger';

const cabin = new Cabin();
logger.log = (...messages) => cabin.info(...messages);
logger.warn = (...messages) => cabin.error(...messages);
logger.error = (...messages) => cabin.error(...messages);
```
