// @flow

// where()s first
// … but where()s with oneOf/notIn last (because it could be a long array)
// then on()s
// … but on()s querying has_manys before on()s querying belongs_tos
// … merge on()s querying the same table

// Goal:
// - order clauses such that heaviest to execute clauses are last
// - order clauses such that we filter out as many records as possible early
//
// It's hard to do this well without knowing the histogram of different values. SQLite can do this
// out of the box, so we probably don't have to worry about it at all. But for Loki, something
// might still be better than nothing...
//
// However we might be able to use information about schema to guess which fields are cheap to query (indexed)
