declare module 'lokijs' {
  declare module.exports: {
    Loki: {...},
    LokiResultset: {...},
    LokiCollection: {...},
    LokiMemoryAdpter: {...},
  }
}

declare module 'lokijs/src/loki-indexed-adapter' {
  declare module.exports: any;
}
