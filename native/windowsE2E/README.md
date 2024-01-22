This is a very hacky way of getting output from Windows WatermelonTester into CI, based on RNW's e2e-test-app project:

https://github.com/microsoft/react-native-windows/tree/main/packages/e2e-test-app
https://github.com/microsoft/react-native-windows/blob/main/docs/e2e-testing.md
https://github.com/microsoft/react-native-windows/tree/main/packages/@react-native-windows/automation

But it's not the right way to do this. Ideally, we'd run WatermelonTester itself in native "test" mode, just like iOS or Android.
I also don't know how to get hold of Windows process stdout/console logs to dump it into CI console, so if it breaks on CI, it
might be difficult to debug.