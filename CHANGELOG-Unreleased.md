### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript
- [Observation] Fixed `canEncodeMatcher()` reporting queries containing `Q.unsafeSqlExpr`,
  `Q.unsafeLokiExpr`, or a `Q.on` nested inside `Q.and`/`Q.or` as encodable.

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
