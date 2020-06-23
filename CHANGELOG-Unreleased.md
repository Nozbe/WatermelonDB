# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [Query] Added the ability to nest `Q.on` conditions inside `Q.and()` and `Q.or()`. To do so, it's
     required to pass `Q.experimentalJoinTables(['join_table1', 'join_table2'])` at the beginning of
     a query. Known limitation: column comparisons don't work within nested `Q.ons` with LokiJSAdapter. For more details, see the docs

### Changes

### Fixes

### Internal

- `QueryDescription` structure has been changed.
