# WatermelonDB Roadmap

## From today to 1.0

### ✅ Done!

WatermelonDB is currently in active development at [Nozbe](https://nozbe.com) for use in advanced projects. It's mostly feature-complete. However, there are a few features left before we can call it 1.0.

- [Migrations](./Advanced/Migrations.md)
- Actions — safe parallel async actions
- Sync Adapter

### v0.xxx

- Full transactionality (atomicity) support ???
- Field sanitizers
- Optimized batch change propagation
- Optimized tree deleting
- API improvements

### v1.0

Everything above plus having at least one non-trivial app using WatermelonDB in production to verify its concepts

### Beyond 1.0

- Replace `withObservables` HOC and Prefetching with a solution based on React 17 Suspense feature
- Query templates
