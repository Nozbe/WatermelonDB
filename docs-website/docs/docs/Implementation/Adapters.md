---
title: Adapters
hide_title: true
---

# Database adapters

The idea for the [Watermelon architecture](./Architecture.md) is to be database-agnostic. `Watermelon` is a cross-platform high-level layer for dealing with data, but can be plugged in to any underlying database, depending on platform needs.

Think of it this way:
- Collection/Model/Query is the **reactive** layer
- `DatabaseAdapter` is the **imperative** layer

The adapter merely performs simple CRUD (create/read/update/delete) operations.

`DatabaseAdapter` is a Flow _interface_. Watermelon comes with two concrete implementations:

## React Native

`SQLiteAdapter` is an adapter for React Native, based on SQLite:

- Queries are converted to SQL on app thread using `adapters/sqlite/encodeQuery`
- Communication happens over `NativeModules` with a native-side bridge
- Native database handling happens on a separate thread
- `DatabaseBridge` is the React Native bridge stub
- `DatabaseDriver` implements Watermelon-specific logic (caching, etc.)
- `Database` is a simple SQLite abstraction layer (over [FMDB](https://github.com/ccgus/fmdb) on iOS and built-in `sqlite.SQLiteDatabase` on Android)

## Web

`LokiJSAdapter` is an adapter for the web, based around [LokiJS](http://techfort.github.io/LokiJS/):

- Why LokiJS? WebSQL would be a perfect fit for Watermelon, but sadly is a dead API, so we must use IndexedDB, but it's too low-level. LokiJS implements a fast querying API on top of IndexedDB.
- `LokiJSAdapter` delegates everything to a separate thread over `LokiDispatcher`
- `LokiDispatcher` spins up a worker thread running `DatabaseBridge`
- `DatabaseBridge` maintains a queue of operations and executes them on `DatabaseDriver`
- `DatabaseDriver` actually implements the Adapter operations
- `encodeQuery` translates `QueryDescription` objects to Loki query objects
- `executeQuery` implements join queries (`Q.on`), which Loki does not support

## Writing your own adapter

If you want to write a new adapter, please contact [@radex](https://github.com/radex) for more information.

⚠️ TODO: This section needs more concrete tips
