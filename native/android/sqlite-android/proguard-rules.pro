-keepclasseswithmembers class io.requery.android.database.** {
  native <methods>;
  public <init>(...);
}
-keepnames class io.requery.android.database.** { *; }
-keep public class io.requery.android.database.sqlite.SQLiteFunction { *; }
-keep public class io.requery.android.database.sqlite.SQLiteConnection { *; }
-keep public class io.requery.android.database.sqlite.SQLiteCustomFunction { *; }
-keep public class io.requery.android.database.sqlite.SQLiteCursor { *; }
-keep public class io.requery.android.database.sqlite.SQLiteDebug** { *; }
-keep public class io.requery.android.database.sqlite.SQLiteDatabase { *; }
-keep public class io.requery.android.database.sqlite.SQLiteOpenHelper { *; }
-keep public class io.requery.android.database.sqlite.SQLiteStatement { *; }
-keep public class io.requery.android.database.CursorWindow { *; }
-keepattributes Exceptions,InnerClasses
