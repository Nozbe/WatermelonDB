# Sync

WatermelonDB has been designed to be used with a synchronization engine to keep the local database up to date with a remote database (and, in effect, keep multiple local copies synced with each other). However, **WatermelonDB is not in itself a sync engine**. Instead, WatermelonDB provides synchronization primitives (information about which records were created, updated, or deleted since the last sync, when those changes occured, and which columns were modified) that you can hook into any sync engine.

⚠️ TODO: This document needs more information. For now, if you want to make Watermelon syncable or need more information about this, please [contact @radex](https://github.com/radex)
