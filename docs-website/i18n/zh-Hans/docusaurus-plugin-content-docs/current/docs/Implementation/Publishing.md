# 发布 WatermelonDB

### 步骤 1：运行所有自动化测试

```bash
yarn ci:check && yarn test:ios && yarn test:android && yarn ktlint
```

### 步骤 2：在真实应用中手动测试

```bash
yarn build
```

然后复制 `dist/` 目录，并用它替换 `app/node_modules/@nozbe/watermelondb` 目录。

如果快速冒烟测试通过，则可以继续进行发布。

### 步骤 3：更新 CHANGELOG

将 `Unreleased` 标题更改为新版本号，并添加新的 `Unreleased` 部分。

### 步骤 4：发布

```bash
npm run release

# 跳过检查（仅在预发布时使用）
npm run release --skip-checks
```

不要使用 `yarn release`（或 `yarn publish`） —— 这将不起作用（Yarn 不支持 NPM 的双因素认证）。
