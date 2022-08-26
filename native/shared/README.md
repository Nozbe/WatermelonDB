# WatermelonDB shared JSI implementation

- you can easily add WatermelonDB to any native platform!
- the platform (OS and JavaScript engine) has to support latest version of React Native, JSI
- what you have to do:
  - compile the files in this folder
  - link sqlite3
  - provide implementation for DatabasePlatform.h
  - provide implementation for JSLockPerfHack.h (just add a stub function that calls the passed block)
  - provide an JSIInstaller that calls Database::install
- check ios/ and android-jsi/ for implementation examples
