# Publishing WatermelonDB

### Step 1: Run all automated tests

```bash
yarn ci:check && yarn test:ios && yarn test:android && yarn swiftlint && yarn ktlint
```

### Step 2: Test manually in a real app

```bash
yarn build
```

Then copy `dist/` and replace `app/node_modules/@nozbe/watermelondb` with it.

If a quick smoke test passes, proceed to publish.

### Step 3: Update CHANGELOG

Change `Unreleased` header to the new version, add new Unreleased

### Step 4: Publish

```bash
npm run release
```

Don't use `yarn release` (or `yarn publish`) — it won't work (yarn doesn't support NPM 2FA).

### Step 5: Update demo/example code

```bash
cd examples/native
yarn upgrade-interactive --latest
yarn dev
yarn start:ios
yarn start:android
```

web:

```bash
cd ../web
yarn upgrade-interactive --latest
yarn dev
# check out if web works
```

Then deploy updated web demo:

```bash
now
now alias watermelondb-xxxxxxxxx.now.sh watermelondb
```
