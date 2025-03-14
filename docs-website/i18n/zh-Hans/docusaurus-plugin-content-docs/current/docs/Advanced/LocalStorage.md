---
title: 本地存储（LocalStorage）
hide_title: true
---

# 本地存储（Local Storage）

WatermelonDB 拥有一个简单的键值存储，类似于 [localStorage](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage)：

```js
// 设置一个值
await database.localStorage.set("user_id", "abcdef")

// 获取一个值
const userId = await database.localStorage.get("user_id") // 如果该键没有值，则为 string 或 undefined

// 删除一个值
await database.localStorage.remove("user_id")
```

**何时使用**：适用于存储如已登录用户的 ID 或应用中最后查看屏幕的路由等信息。一般情况下，你应该避免使用它，而是坚持使用标准的 Watermelon 记录。

**这是一个底层 API**：你无法实现诸如随时间观察值的变化等功能。如果你需要这些功能，只需使用标准的 WatermelonDB 记录。你只能存储可进行 JSON 序列化的值。

**需要注意的事项**：请勿将用户提供的值用作本地存储的键。仅允许使用预定义/白名单中的键。以 `__` 开头的键名是为 WatermelonDB 预留的（例如，同步功能会使用这些键来记录上次同步的时间）。

**为什么不使用 localStorage/AsyncStorage？** 因为这样一来，你只有一个事实来源 —— 一个数据库，例如，它既存储已登录用户的 ID，又存储所有用户的信息。因此，两组值不同步的风险更低。
