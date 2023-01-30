---
title: See the demo
---

See how WatermelonDB performs at large scales in the demo app.

## Online demo

<h3>
<a href="https://watermelondb.now.sh">
    <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-demo-medium.png" alt="WatermelonDB Demo" width="600" /><br/>
    Check out WatermelonDB demo online
</a>
</h3>

Note that where Watermelon really shines is in React Native apps — see instructions below ⬇️

## Running React Native demo

To compile the WatermelonDB demo on your own machine:

1. Install [React Native toolkit](https://facebook.github.io/react-native/docs/getting-started.html) if you haven't already
2. Download this project
   ```bash
   git clone https://github.com/Nozbe/WatermelonDB.git
   cd WatermelonDB/examples/native
   yarn
   ```
3. Run the React Native packager:
   ```bash
   yarn dev
   ```
4. Run the app on iOS or Android:
   ```bash
   yarn start:ios # or:
   yarn start:android
   ```

⚠️ Note that for accurate measurement of performance, you need to compile the demo app in Release mode and run it on a real device, not the simulator.

⚠️ If iOS app doesn't compile, try running it from Xcode instead of the terminal first

⚠️ You might want to `git checkout` the [latest stable tag](https://github.com/Nozbe/WatermelonDB/releases) if the demo app doesn't work

## Running web demo

To compile the WatermelonDB demo on your own machine:

1. Download this project
   ```bash
   git clone https://github.com/Nozbe/WatermelonDB.git
   cd WatermelonDB/examples/web
   yarn
   ```
2. Run the server:
   ```bash
   yarn dev
   ```
3. Webpack will point you to the right URL to open in the browser

You can also [use Now](https://zeit.co/now) to deploy the demo app (requires a Zeit account):

```bash
now
```

⚠️ You might want to `git checkout` the [latest stable tag](https://github.com/Nozbe/WatermelonDB/releases) if the demo app doesn't work
