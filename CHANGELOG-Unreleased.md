# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [Android] `exerimentalUseJSI` option has been enabled on Android
- [iOS] Added CocoaPods support - @leninlin
- [Query] `Q.on` queries are now far more flexible. Previously, they could only be placed at the top
    level of a query. See Docs for more details. Now, you can:

     - Pass multiple conditions on the related query, like so:

        ```js
        collection.query(
          Q.on('projects', [
            Q.where('foo', 'bar'),
            Q.where('bar', 'baz'),
          ])
        )
        ```
     - You can place `Q.on` deeper inside the query (nested inside `Q.and()`, `Q.or()`). However, you
        must explicitly list all tables you're joining on at the beginning of a query, using:
        `Q.experimentalJoinTables(['join_table1', 'join_table2'])`.
     - You can nest `Q.on` conditions inside `Q.on`, e.g. to make a condition on a grandchild.
          To do so, it's required to pass `Q.experimentalNestedJoin('parent_table', 'grandparent_table')` at the beginning
          of a query

### Changes

- [DX] Queries with bad associations now show more helpful error message

### Fixes

### Internal

- `QueryDescription` structure has been changed.
