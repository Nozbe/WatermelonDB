package com.nozbe.watermelondb;

import android.database.Cursor;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

public class DatabaseUtils {
    public static WritableMap cursorToMap(Cursor cursor) {
        WritableMap map = Arguments.createMap();
        for (int i = 0; i < cursor.getColumnCount(); i++) {
            switch (cursor.getType(i)) {
                case Cursor.FIELD_TYPE_NULL:
                    map.putNull(cursor.getColumnName(i));
                    break;
                case Cursor.FIELD_TYPE_INTEGER:
                case Cursor.FIELD_TYPE_FLOAT:
                    map.putDouble(cursor.getColumnName(i), cursor.getDouble(i));
                    break;
                case Cursor.FIELD_TYPE_STRING:
                    map.putString(cursor.getColumnName(i), cursor.getString(i));
                    break;
                case Cursor.FIELD_TYPE_BLOB:
                default:
                    map.putString(cursor.getColumnName(i), "");
                    break;
            }
        }
        return map;
    }

    public static <T> boolean arrayContains(final T[] array, final T value) {
        if (value == null) {
            for (final T e : array) {
                if (e == null) {
                    return true;
                }
            }
        }
        else {
            for (final T e : array) {
                if (e == value || value.equals(e)) {
                    return true;
                }
            }
        }

        return false;
    }
}
