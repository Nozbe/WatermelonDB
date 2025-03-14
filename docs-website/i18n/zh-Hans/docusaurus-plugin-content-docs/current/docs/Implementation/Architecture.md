# Architecture

## Base objects

`Database` is the root object of Watermelon. It owns:

- a `DatabaseAdapter`
- a map of `Collection`s

`DatabaseAdapter` connects Watermelon's reactive world to low-level imperative world of databases. See [Adapters](./DatabaseAdapters.md).

`Collection` manages all records of a given kind:

- it has a cache of records already fetched from the database (`RecordCache`)
- it has the public API to `find`, `query` and `create` existing records
- it implements fetch/update/delete operations on records

`Model` is an instance of a collection record. A model _class_ describes a _kind_ of a record. `Model` is the base class for your concrete models (e.g. `Post`, `Comment`, `Task`):

- it describes the specific instance - `id` + all custom fields and actions
- it has public API to `update`, `markAsDeleted` and `destroyPermanently`
- implements record-level observation `observe()`
- static fields describe base information about a model (`table`, `associations`) - See [Defining models](../Model.md)

As a general rule, `Model` manages the state of a specific instance, and `Collection` of the entire collection of records. So for example, `model.markAsDeleted()` changes the local state of called record, but then delegates to its collection to notify collection observers and actually remove from the database

`Query` is a helper object that gives us a nice API to perform queries (`query.observe()`, `query.fetchCount()`):

- created via `collection.query()`
- encapsulates a `QueryDescription` structure which actually describes the query conditions
- fetch/observe methods actually delegate to `Collection` to perform database operations
- caches `Observable`s created by `observe/observeCount` methods so they can be reused and shared

## Helper functions

Watermelon's objects and classes are meant to be as minimal as possible — only manage their own state and be an API for your app. Most logic should be stateless, and implemented as pure functions:

`QueryDescription` is a structure (object) describing the query, built using `Q.*` helper functions

`encodeMatcher()`, `simpleObserver()`, `reloadingObserver()`, `fieldObserver()` implement query observation logic.

Model decorators transform simple class properties into Watermelon-aware record fields.

Much of Adapters' logic is implemented as pure functions too. See [Adapters](./DatabaseAdapters.md).
