# Contributing guidelines

## Running Watermelon in development

```bash
git clone https://github.com/Nozbe/WatermelonDB.git
cd WatermelonDB
yarn
```

### Running tests

This runs Jest, ESLint and Flow:

```bash
yarn ci:check
```

You can also run them separately:

```bash
yarn test
yarn eslint
yarn flow
```

### Editing files

We recommend VS Code with ESLint, Flow, and Prettier (with prettier-eslint enabled) plugins for best development experience. (To see lint/type issues inline + have automatic reformatting of code)

### Before you send a pull request

1. **Did you add or changed some functionality?**

   Add (or modify) tests!
2. **Check if the automated tests pass**
   ```bash
   yarn ci:check
   ```
3. **Format the files you changed**
   ```bash
   yarn prettier
   ```
4. **Mark your changes in CHANGELOG**

   Put a one-line description of your change under Added/Changed section. See [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Editing native code

In `native/ios` and `native/android` you'll find the native bridge code for React Native.

It's recommended to use the latest stable version of Xcode / Android Studio to work on that code.

### Integration tests

If you change native bridge code or `adapter/sqlite` code, it's recommended to run integration tests that run the entire Watermelon code with SQLite and React Native in the loop:

```bash
yarn test:ios
yarn test:android
```

#### Running tests manualy
- For iOS open the `native/iosTest/WatermelonTester.xcworkspace` project and hit Cmd+U.
- For Android open `native/androidTest` in AndroidStudio navigate to `app/src/androidTest/java/com.nozbe.watermelonTest/BridgeTest` and click green arrow near `class BridgeTest`


### Native linting

Make sure the native code you're editing conforms to Watermelon standards:

```bash
yarn swiftlint
yarn ktlint
```
