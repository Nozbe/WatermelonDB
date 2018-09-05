# Demo

See how WatermelonDB performs at large scales in the demo app.

## See web demo online

⚠️ Coming soon!

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
3. Open [localhost:8888](http://localhost:8888)
