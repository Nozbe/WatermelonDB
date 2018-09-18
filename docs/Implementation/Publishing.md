# Publishing WatermelonDB

### Step 1: Run all automated tests

```js
yarn ci:check
yarn test:ios
yarn test:android
yarn swiftlint
yarn ktlint
```

### Step 2: Test manually in a real app

```js
yarn build
```

Then copy `dist/` and replace `app/node_modules/@nozbe/watermelondb` with it.

If a quick smoke test passes, proceed to publish.

### Step 3: Update CHANGELOG

Change `Unreleased` header to the new version, add new Unreleased

### Publish

```
npm run release
```

Don't use `yarn release` (or `yarn publish`) — it won't work (yarn doesn't support NPM 2FA).
