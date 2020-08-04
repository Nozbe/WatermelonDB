# Various Pro Tips

## Database viewer

**Android** - you can use the new database inspector which comes with the Android Studio Beta. https://medium.com/androiddevelopers/database-inspector-9e91aa265316

**iOS** - check open database path in iOS System Log (via Console for plugged-in device, or Xcode logs), then open it via `sqlite3` in the console, or an external tool like https://sqlitebrowser.org

## Prepopulating database on native

There's no built-in support for this. One way is to generate a SQLite DB (you can use the the Node SQLite support in 0.19.0-2 pre-release or extract it from an ios/android app), bundle it with the app, and then use a bit of code to check if the DB you're expecting it available, and if not, making a copy of the default DB — before you attempt loading DB from JS side. See this thread: https://github.com/Nozbe/WatermelonDB/issues/774#issuecomment-667981361
