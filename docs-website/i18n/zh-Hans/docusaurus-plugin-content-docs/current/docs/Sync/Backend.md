---
title: Backend
hide_title: true
---

## Implementing your Sync backend

### Understanding `changes` objects

Synchronized changes (received by the app in `pullChanges` and sent to the backend in `pushChanges`) are represented as an object with _raw records_. Those only use raw table and column names, and raw values (strings/numbers/booleans) — the same as in [Schema](../Schema.md).

Deleted objects are always only represented by their IDs.

Example:

```js
{
  projects: {
    created: [
      { id: 'aaaa', name: 'Foo', is_favorite: true },
      { id: 'bbbb', name: 'Bar', is_favorite: false },
    ],
    updated: [
      { id: 'ccc', name: 'Baz', is_favorite: true },
    ],
    deleted: ['ddd'],
  },
  tasks: {
    created: [],
    updated: [
      { id: 'tttt', name: 'Buy eggs' },
    ],
    deleted: [],
  },
  ...
}
```

Again, notice the properties returned have the format defined in the [Schema](../Schema.md) (e.g. `is_favorite`, not `isFavorite`).

Valid changes objects MUST conform to this shape:

```js
Changes = {
  [table_name: string]: {
    created: RawRecord[],
    updated: RawRecord[],
    deleted: string[],
  }
}
```

### Implementing pull endpoint

Expected parameters:

```js
{
  lastPulledAt: Timestamp,
  schemaVersion: int,
  migration: null | { from: int, tables: string[], columns: { table: string, columns: string[] }[] }
}
```

Expected response:

```js
{ changes: Changes, timestamp: Timestamp }
```

1. The pull endpoint SHOULD take parameters and return a response matching the shape specified above.
   This shape MAY be different if negotiated with the frontend (however, frontend-side `pullChanges()` MUST conform to this)
2. The pull endpoint MUST return all record changes in all collections since `lastPulledAt`, specifically:
    - all records that were created on the server since `lastPulledAt`
    - all records that were updated on the server since `lastPulledAt`
    - IDs of all records that were deleted on the server since `lastPulledAt`
    - record IDs MUST NOT be duplicated
3. If `lastPulledAt` is null or 0, you MUST return all accessible records (first sync)
4. The timestamp returned by the server MUST be a value that, if passed again to `pullChanges()` as `lastPulledAt`, will return all changes that happened since this moment.
5. The pull endpoint MUST provide a consistent view of changes since `lastPulledAt`
    - You should perform all queries synchronously or in a write lock to ensure that returned changes are consistent
    - You should also mark the current server time synchronously with the queries
    - This is to ensure that no changes are made to the database while you're fetching changes (otherwise some records would never be returned in a pull query)
    - If it's absolutely not possible to do so, and you have to query each collection separately, be sure to return a `lastPulledAt` timestamp marked BEFORE querying starts. You still risk inconsistent responses (that may break app's consistency assumptions), but the next pull will fetch whatever changes occured during previous pull.
    - An alternative solution is to check for the newest change before and after all queries are made, and if there's been a change during the pull, return an error code, or retry.
6. If `migration` is not null, you MUST include records needed to get a consistent view after a local database migration
    - Specifically, you MUST include all records in tables that were added to the local database between the last user sync and `schemaVersion`
    - For all columns that were added to the local app database between the last sync and `schemaVersion`, you MUST include all records for which the added column has a value other than the default value (`0`, `''`, `false`, or `null` depending on column type and nullability)
    - You can determine what schema changes were made to the local app in two ways:
        - You can compare `migration.from` (local schema version at the time of the last sync) and `schemaVersion` (current local schema version). This requires you to negotiate with the frontend what schema changes are made at which schema versions, but gives you more control
        - Or you can ignore `migration.from` and only look at `migration.tables` (which indicates which tables were added to the local database since the last sync) and `migration.columns` (which indicates which columns were added to the local database to which tables since last sync).
        - If you use `migration.tables` and `migration.columns`, you MUST whitelist values a client can request. Take care not to leak any internal fields to the client.
7. Returned raw records MUST match your app's [Schema](../Schema.md)
8. Returned raw records MUST NOT not contain special `_status`, `_changed` fields.
9. Returned raw records MAY contain fields (columns) that are not yet present in the local app (at `schemaVersion` -- but added in a later version). They will be safely ignored.
10. Returned raw records MUST NOT contain arbitrary column names, as they may be unsafe (e.g. `__proto__` or `constructor`). You should whitelist acceptable column names.
11. Returned record IDs MUST only contain safe characters
    - Default WatermelonDB IDs conform to `/^[a-zA-Z0-9]{16}$/`
    - `_-.` are also allowed if you override default ID generator, but `'"\/$` are unsafe
12. Changes SHOULD NOT contain collections that are not yet present in the local app (at `schemaVersion`). They will, however, be safely ignored.
    - NOTE: This is true for WatermelonDB v0.17 and above. If you support clients using earlier versions, you MUST NOT return collections not known by them.
13. Changes MUST NOT contain collections with arbitrary names, as they may be unsafe. You should whitelist acceptable collection names.

### Implementing push endpoint

1. The push endpoint MUST apply local changes (passed as a `changes` object) to the database. Specifically:
    - create new records as specified by the changes object
    - update existing records as specified by the changes object
    - delete records by the specified IDs
2. If the `changes` object contains a new record with an ID that already exists, you MUST update it, and MUST NOT return an error code.
    - (This happens if previous push succeeded on the backend, but not on frontend)
3. If the `changes` object contains an update to a record that does not exist, then:
    - If you can determine that this record no longer exists because it was deleted, you SHOULD return an error code (to force frontend to pull the information about this deleted ID)
    - Otherwise, you MUST create it, and MUST NOT return an error code. (This scenario should not happen, but in case of frontend or backend bugs, it would keep sync from ever succeeding.)
4. If the `changes` object contains a record to delete that doesn't exist, you MUST ignore it and MUST NOT return an error code
    - (This may happen if previous push succeeded on the backend, but not on frontend, or if another user deleted this record in between user's pull and push calls)
5. If the `changes` object contains a record that has been modified on the server after `lastPulledAt`, you MUST abort push and return an error code
    - This scenario means that there's a conflict, and record was updated remotely between user's pull and push calls. Returning an error forces frontend to call pull endpoint again to resolve the conflict
6. If application of all local changes succeeds, the endpoint MUST return a success status code.
7. The push endpoint MUST be fully transactional. If there is an error, all local changes MUST be reverted on the server, and en error code MUST be returned.
8. You MUST ignore `_status` and `_changed` fields contained in records in `changes` object
9. You SHOULD validate data passed to the endpoint. In particular, collection and column names ought to be whitelisted, as well as ID format — and of course any application-specific invariants, such as permissions to access and modify records
10. You SHOULD sanitize record fields passed to the endpoint. If there's something slightly wrong with the contents (but not shape) of the data (e.g. `user.role` should be `owner`, `admin`, or `member`, but user sent empty string or `abcdef`), you SHOULD NOT send an error code. Instead, prefer to "fix" errors (sanitize to correct format).
    - Rationale: Synchronization should be reliable, and should not fail other than transiently, or for serious programming errors. Otherwise, the user will have a permanently unsyncable app, and may have to log out/delete it and lose unsynced data. You don't want a bug 5 versions ago to create a persistently failing sync.
11. You SHOULD delete all descendants of deleted records
    - Frontend should ask the push endpoint to do so as well, but if it's buggy, you may end up with permanent orphans

## Tips on implementing server-side changes tracking

If you're wondering how to _actually_ implement consistent pulling of all changes since the last pull, or how to detect that a record being pushed by the user changed after `lastPulledAt`, here's what we recommend:

- Add a `last_modified` field to all your server database tables, and bump it to `NOW()` every time you create or update a record.
- This way, when you want to get all changes since `lastPulledAt`, you query records whose `last_modified > lastPulledAt`.
- The timestamp should be at least millisecond resolution, and you should add (for extra safety) a MySQL/PostgreSQL procedure that will ensure `last_modified` uniqueness and monotonicity
    - Specificaly, check that there is no record with a `last_modified` equal to or greater than `NOW()`, and if there is, increment the new timestamp by 1 (or however much you need to ensure it's the greatest number)
    - [An example of this for PostgreSQL can be found in Kinto](https://github.com/Kinto/kinto/blob/814c30c5dd745717b8ea50d708d9163a38d2a9ec/kinto/core/storage/postgresql/schema.sql#L64-L116)
    - This protects against weird edge cases - such as records being lost due to server clock time changes (NTP time sync, leap seconds, etc.)
- Of course, remember to ignore `last_modified` from the user if you do it this way.
- An alternative to using timestamps is to use an auto-incrementing counter sequence, but you must ensure that this sequence is consistent across all collections. You also leak to users the amount of traffic to your sync server (number of changes in the sequence)
- To distinguish between `created` and `updated` records, you can also store server-side `server_created_at` timestamp (if it's greater than `last_pulled_at` supplied to sync, then record is to be `created` on client, if less than — client already has it and it is to be `updated` on client). Note that this timestamp must be consistent with last_modified — and you must not use client-created `created_at` field, since you can never trust local timestamps.
    - Alternatively, you can send all non-deleted records as all `updated` and Watermelon will do the right thing in 99% of cases (you will be slightly less protected against weird edge cases — treatment of locally deleted records is different). If you do this, pass `sendCreatedAsUpdated: true` to `synchronize()` to supress warnings about records to be updated not existing locally.
- You do need to implement a mechanism to track when records were deleted on the server, otherwise you wouldn't know to push them
    - One possible implementation is to not fully delete records, but mark them as DELETED=true
    - Or, you can have a `deleted_xxx` table with just the record ID and timestamp (consistent with last_modified)
    - Or, you can treat it the same way as "revoked permissions"
- If you have a collaborative app with any sort of permissions, you also need to track granting and revoking of permissions the same way as changes to records
    - If permission to access records has been granted, the pull endpoint must add those records to `created`
    - If permission to access records has been revoked, the pull endpoint must add those records to `deleted`
    - Remember to also return all descendants of a record in those cases

## Existing Backend Implementations

Note that those are not maintained by WatermelonDB, and we make no endorsements about quality of these projects:

- [How to Build WatermelonDB Sync Backend in Elixir](https://fahri.id/posts/how-to-build-watermelondb-sync-backend-in-elixir/)
- [Firemelon](https://github.com/AliAllaf/firemelon)
- [Laravel Watermelon](https://github.com/nathanheffley/laravel-watermelon)

Did you make one? Please contribute a link!
