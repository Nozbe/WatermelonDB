
**⚠️ Note about a React Native / UglifyES bug**. When you import Watermelon Sync, your app might fail to compile in release mode. To fix this, configure Metro bundler to use Terser instead of UglifyES. Run:

```bash
yarn add metro-minify-terser
```

Then, update `metro.config.js`:

```js
module.exports = {
    // ...
    transformer: {
        // ...
        minifierPath: 'metro-minify-terser',
    },
}
```

You might also need to switch to Terser in Webpack if you use Watermelon for web.
