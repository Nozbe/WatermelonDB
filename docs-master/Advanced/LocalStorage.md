# Local storage

WatermelonDB has a simple key/value store, similar to [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage):

```js
// setting a value
await database.adapter.setLocal("user_id", "abcdef")

// retrieving a value
const userId = await database.adapter.getLocal("user_id") // string or undefined if no value for this key

// removing a value
await database.adapter.removeLocal("user_id")
```

**When to use it**. For things like the ID of the logged-in user, or the route to the last-viewed screen in the app. You should generally avoid it and stick to standard Watermelon records.

**This is a low-level API**. You can't do things like observe changes of a value over time. If you need that, just use standard WatermelonDB records. You can only store JSON-serializable values

**What to be aware of**. DO NOT let the local storage key be a user-supplied value. Only allow predefined/whitelisted keys. Key names starting with `__` are reserved for WatermelonDB use (e.g. used by Sync to remember time of last sync)

**Why not use localStorage/AsyncStorage?** Because this way, you have only one source of truth — one database that, say, stores the logged-in user ID and the information about all users. So there's a lower risk that the two sets of values get out of sync.
