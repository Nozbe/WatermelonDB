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
