
1. If a record being pushed changes remotely between pull and push, push will just fail. It would be better if it failed with a list of conflicts, so that `synchronize()` can automatically respond. Alternatively, sync could only send changed fields and server could automatically always just apply those changed fields to the server version (since that's what per-column client-wins resolver will do anyway)
2. During next sync pull, changes we've just pushed will be pulled again, which is unnecessary. It would be better if server, during push, also pulled local changes since `lastPulledAt` and responded with NEW timestamp to be treated as `lastPulledAt`.
3. It shouldn't be necessary to push the whole updated record — just changed fields + ID should be enough
   > Note: That might conflict with "If client wants to update a record that doesn’t exist, create it"

<br/>

Don't like these limitations?
Good, neither do we! Please [contribute](../Sync/Contribute.md) - we'll give you guidance.
