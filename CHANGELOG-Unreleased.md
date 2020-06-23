# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [Query] Added the ability to nest `Q.on` conditions inside `Q.and()` and `Q.or()`. To do so, it's
     required to pass `Q.experimentalJoinTables(['join_table1', 'join_table2'])` at the beginning of
     a query. Known limitation: column comparisons don't work within nested `Q.ons` with LokiJSAdapter. For more details, see the docs
- [Query] Added the ability to nest `Q.on` conditions inside `Q.on`, e.g. to make a condition on a grandchild.
     To do so, it's required to pass `Q.experimentalNestedJoin('parent_table', 'grandparent_table')` at the beginning
     of a query. Known limitations: only one level of nesting is currently allowed. For more details, see the docs

### Changes

- [DX] Queries with bad associations now show more helpful error message

### Fixes

### Internal

- `QueryDescription` structure has been changed.
