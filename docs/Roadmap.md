# WatermelonDB Roadmap

## From today to 1.0

### v0.6

WatermelonDB is currently in active development at [Nozbe](https://nozbe.com) for use in advanced projects. It's mostly feature-complete. However, there are a few features left before we can call it 1.0.

### v0.7

- [Migrations](./Advanced/Migrations.md)

**This is coming soon**. It's probably the only feature preventing WatermelonDB from being safely used in a production app.

### v0.8 - v0.9

- Full Transaction support
  - We already support batch changes, but exclusive write lock is missing to ensure consistency of async actions
- Field sanitizers
- Optimized batch change propagation
- Optimized tree deleting
- API improvements

### v1.0

Everything above plus having at least one non-trivial app using WatermelonDB in production to verify its concepts

### Beyond 1.0

- Replace `withObservables` HOC and Prefetching with a solution based on React 17 Suspense feature
- Query templates
