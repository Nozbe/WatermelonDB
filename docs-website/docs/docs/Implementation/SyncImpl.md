---
title: Sync implementation
hide_title: true
---

# Sync implementation details

If you're looking for a guide to implement Watermelon Sync in your app, see [**Synchronization**](../Sync/Intro.md).

If you want to contribute to Watermelon Sync, or implement your own synchronization engine from scratch, read this.

## Implementing your own sync from scratch

For basic details about how changes tracking works, see: [📺 Digging deeper into WatermelonDB](https://www.youtube.com/watch?v=uFvHURTRLxQ)

Why you might want to implement a custom sync engine? If you have an existing remote server architecture that's difficult to adapt to Watermelon sync protocol, or you specifically want a different architecture (e.g. single HTTP request -- server resolves conflicts). Be warned, however, that **implementing sync that works reliably** is a hard problem, so we recommend sticking to Watermelon Sync and tweaking it as needed.

The rest of this document contains details about how Watermelon Sync works - you can use that as a blueprint for your own work.

If possible, please use sync implementation helpers from `sync/*.js` to keep your custom sync implementation have as much commonality as possible with the standard implementation. This is good both for you and for the rest of WatermelonDB community, as we get to share improvements and bug fixes. If the helpers are _almost_ what you need, but not quite, please send pull requests with improvements!

## Watermelon Sync -- Details

### General design

- master/replica - server is the source of truth, client has a full copy and syncs back to server (no peer-to-peer syncs)
- two phase sync: first pull remote changes to local app, then push local changes to server
- client resolves conflicts
- content-based, not time-based conflict resolution
- conflicts are resolved using per-column client-wins strategy: in conflict, server version is taken
  except for any column that was changed locally since last sync.
- local app tracks its changes using a _status (synced/created/updated/deleted) field and _changes
  field (which specifies columns changed since last sync)
- server only tracks timestamps (or version numbers) of every record, not specific changes
- sync is performed for the entire database at once, not per-collection
- eventual consistency (client and server are consistent at the moment of successful pull if no
  local changes need to be pushed)
- non-blocking: local database writes (but not reads) are only momentarily locked when writing data
  but user can safely make new changes throughout the process

### Sync procedure

1. Pull phase
  - get `lastPulledAt` timestamp locally (null if first sync)
  - call `pullChanges` function, passing `lastPulledAt`
    - server responds with all changes (create/update/delete) that occured since `lastPulledAt`
    - server serves us with its current timestamp
  - IN ACTION (lock local writes):
    - ensure no concurrent syncs
    - apply remote changes locally
      - insert new records
        - if already exists (error), update
        - if locally marked as deleted (error), un-delete and update
      - update records
        - if synced, just replace contents with server version
        - if locally updated, we have a conflict!
          - take remote version, apply local fields that have been changed locally since last sync
            (per-column client wins strategy)
          - record stays marked as updated, because local changes still need to be pushed
        - if locally marked as deleted, ignore (deletion will be pushed later)
        - if doesn't exist locally (error), create
      - destroy records
        - if alredy deleted, ignore
        - if locally changed, destroy anyway
        - ignore children (server ought to schedule children to be destroyed)
    - if successful, save server's timestamp as new `lastPulledAt`
2. Push phase
  - Fetch local changes
    - Find all locally changed records (created/updated record + deleted IDs) for all collections
    - Strip _status, _changed
  - Call `pushChanges` function, passing local changes object, and the new `lastPulledAt` timestamp
    - Server applies local changes to database, and sends OK
    - If one of the pushed records has changed *on the server* since `lastPulledAt`, push is aborted,
      all changes reverted, and server responds with an error
  - IN ACTION (lock local writes):
    - markLocalChangesAsSynced:
      - take local changes fetched in previous step, and:
      - permanently destroy records marked as deleted
      - mark created/updated records as synced and reset their _changed field
      - note: *do not* mark record as synced if it changed locally since `fetch local changes` step
        (user could have made new changes that need syncing)

### Notes

- This procedure is designed such that if sync fails at any moment, and even leaves local app in
  inconsistent (not fully synced) state, we should still achieve consistency with the next sync:
  - applyRemoteChanges is designed such that if all changes are applied, but `lastPulledAt` doesn't get
    saved — so during next pull server will serve us the same changes, second applyRemoteChanges will
    arrive at the same result
  - local changes before "fetch local changes" step don't matter at all - user can do anything
  - local changes between "fetch local changes" and "mark local changes as synced" will be ignored
    (won't be marked as synced) - will be pushed during next sync
  - if changes don't get marked as synced, and are pushed again, server should apply them the same way
  - remote changes between pull and push phase will be locally ignored (will be pulled next sync)
    unless there's a per-record conflict (then push fails, but next sync resolves both pull and push)

### Migration Syncs

Schema versioning and migrations complicate sync, because a client might not be able to sync some tables and columns, but after upgrade to the newest version, it should be able to get consistent sync. To be able
to do that, we need to know what's the schema version at which the last sync occured. Unfortunately,
Watermelon Sync didn't track that from the first version, so backwards-compat is required.

```
synchronize({ migrationsEnabledAtVersion: XXX })

. . . .

LPA = last pulled at
MEA = migrationsEnabledAtVersion, schema version at which future migration support was introduced
LS = last synced schema version (may be null due to backwards compat)
CV = current schema version

LPA     MEA     LS      CV      migration   set LS=CV?   comment

null    X       X       10      null        YES          first sync. regardless of whether the app
                                                         is migration sync aware, we can note LS=CV
                                                         to fetch all migrations once available

100     null    X       X       null        NO           indicates app is not migration sync aware so
                                                         we're not setting LS to allow future migration sync

100     X       10      10      null        NO           up to date, no migration
100     9       9       10      {9-10}      YES          correct migration sync
100     9       null    10      {9-10}      YES          fallback migration. might not contain all
                                                         necessary migrations, since we can't know for sure
                                                         that user logged in at then-current-version==MEA

100     9       11      10      ERROR       NO           LS > CV indicates programmer error
100     11      X       10      ERROR       NO           MEA > CV indicates programmer error
```

### Reference

This design has been informed by:

- 10 years of experience building synchronization at Nozbe
- Kinto & Kinto.js
  - https://github.com/Kinto/kinto.js/blob/master/src/collection.js
  - https://kintojs.readthedocs.io/en/latest/api/#fetching-and-publishing-changes
- Histo - https://github.com/mirkokiefer/syncing-thesis
