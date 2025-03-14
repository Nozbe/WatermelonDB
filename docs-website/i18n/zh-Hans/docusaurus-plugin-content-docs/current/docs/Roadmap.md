---
title: 路线图
hide_title: true
---

# WatermelonDB 路线图

尽管版本号为 0.xx，但 WatermelonDB 实际上已基本完成功能开发，并且其 API 相对稳定。[Nozbe Teams](https://nozbe.com) 等众多项目都在生产环境中使用了该数据库。

我们之所以未将其版本号定为 1.0，主要是为了方便在不按照语义化版本控制（SemVer）规则增加 `主版本号` 的情况下进行快速开发。一旦我们能实现长期稳定的 API，就会将 WatermelonDB 定为 1.0 版本。

### 1.0 版本

- 优化树删除功能
- 实现长期稳定的 API

### 1.0 之后的版本

- 是否支持完整的事务性（原子性）？
- 字段清理器
