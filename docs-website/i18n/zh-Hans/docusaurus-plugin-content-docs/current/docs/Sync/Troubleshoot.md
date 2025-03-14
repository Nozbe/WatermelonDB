---
title: 故障排除
---

**⚠️ 关于 React Native / UglifyES 漏洞的注意事项**：当你导入 Watermelon Sync 时，你的应用在发布模式下可能无法编译。要修复这个问题，请将 Metro 打包器配置为使用 Terser 而不是 UglifyES。运行以下命令：

```bash
yarn add metro-minify-terser
```

然后更新 `metro.config.js` 文件：

```js
module.exports = {
    // ...
    transformer: {
        // ...
        minifierPath: 'metro-minify-terser',
    },
}
```

如果你在 Web 项目中使用 Watermelon，你可能还需要在 Webpack 中切换到使用 Terser。
