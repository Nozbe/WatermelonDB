---
title: 贡献指南
hide_title: true
---

<img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/needyou.jpg" alt="We need you" width="220" />

**WatermelonDB 是一个开源项目，它需要你的帮助才能蓬勃发展！**

如果你发现有缺失的功能、bug 或其他需要改进的地方，我们鼓励你做出贡献！你可以随时开启一个 issue 以获取指导，并查看[贡献指南](./CONTRIBUTING.md)了解项目设置、测试等详细信息。

如果你刚刚开始参与，可查看[适合新手的问题](https://github.com/Nozbe/WatermelonDB/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)，这些问题很容易参与贡献。如果你做出了重要贡献，给我发邮件，我会送你一个漂亮的🍉贴纸！

如果你正在使用或考虑使用 WatermelonDB 开发应用，请告诉我们！

<br />


## 在发送拉取请求之前

1. 你是否添加或修改了某些功能？

   添加（或修改）测试！
2. 检查自动化测试是否通过
   ```bash
   yarn ci:check
   ```
3. 格式化你修改的文件
   ```bash
   yarn prettier
   ```
4. 在CHANGELOG中标记你的更改

   在新增/更改部分下添加一行对更改的描述。请参阅[保持更新日志](https://keepachangelog.com/en/1.0.0/)。

## 在开发环境中运行Watermelon

### 下载源代码和依赖项

```bash
git clone https://github.com/Nozbe/WatermelonDB.git
cd WatermelonDB
yarn
```

### 在你的应用中同时开发Watermelon

要在你的应用沙箱中处理Watermelon代码，请执行以下操作：

```bash
yarn dev
```

这将在Watermelon中创建一个 `dev/` 文件夹，并监控源文件（仅 JavaScript 文件）的更改，并根据需要重新编译它们。

然后在你的应用中：

```bash
cd node_modules/@nozbe
rm -fr watermelondb
ln -s path-to-watermelondb/dev watermelondb
```

**这在 Webpack 中可行，但在 Metro（React Native）中不可行**。Metro 不支持符号链接。相反，你可以将WatermelonDB直接编译到你的项目中：

```bash
DEV_PATH="/path/to/your/app/node_modules/@nozbe/watermelondb" yarn dev
```

### 运行测试

这将运行 Jest、ESLint 和 Flow：

```bash
yarn ci:check
```

你也可以单独运行它们：

```bash
yarn test
yarn eslint
yarn flow
```

### 编辑文件

我们建议使用带有 ESLint、Flow 和 Prettier（启用 prettier-eslint）插件的 VS Code，以获得最佳开发体验。（可实时查看 lint/类型问题 + 自动格式化代码）

## 编辑原生代码

在 `native/ios` 和 `native/android` 中，你可以找到 React Native 的原生桥接代码。

建议使用最新稳定版本的 Xcode / Android Studio 来处理该代码。

### 集成测试

如果你更改了原生桥接代码或 `adapter/sqlite` 代码，建议运行集成测试，该测试将在 SQLite 和 React Native 的环境中运行整个 Watermelon 代码：

```bash
yarn test:ios
yarn test:android
```

### 手动运行测试

- 对于 iOS，打开 `native/iosTest/WatermelonTester.xcworkspace` 项目，然后按下 Cmd + U。
- 对于 Android，在 Android Studio 中打开 `native/androidTest` 项目，导航到 `app/src/androidTest/java/com.nozbe.watermelonTest/BridgeTest`，然后点击 `class BridgeTest` 旁边的绿色箭头。

### 原生代码检查

确保你正在编辑的原生代码符合 Watermelon 的标准：

```bash
yarn ktlint
```

### 原生代码故障排除

1. 如果在终端中运行 `test:ios` 失败：
- 先在 Xcode 中运行测试，然后再从终端运行
- 确保你在“Preferences(偏好设置)” -> “Locations(位置)”中设置了正确版本的 Xcode 命令行工具
1. 确保你使用的是 Xcode / Android Studio 的最新稳定版本
1. 删除原生缓存：
- Xcode：`~/Library/Developer/Xcode/DerivedData`
- Android：`native/android` 和 `native/androidTest` 中的 `.gradle` 和 `build` 文件夹
- `node_modules`（由于 React Native 预编译的第三方库）


