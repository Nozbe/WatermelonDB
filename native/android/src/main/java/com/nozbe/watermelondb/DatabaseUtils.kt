package com.nozbe.watermelondb

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray

typealias SQL = String
typealias RecordID = String
typealias TableName = String
typealias QueryArgs = ArrayList<Any>
typealias RawQueryArgs = Array<String>
typealias ConnectionTag = Int

fun WritableMap.mapCursor(cursor: Cursor) {
    for (i in 0 until cursor.columnCount) {
        when (cursor.getType(i)) {
            Cursor.FIELD_TYPE_NULL -> putNull(cursor.getColumnName(i))
            Cursor.FIELD_TYPE_INTEGER -> putDouble(cursor.getColumnName(i), cursor.getDouble(i))
            Cursor.FIELD_TYPE_FLOAT -> putDouble(cursor.getColumnName(i), cursor.getDouble(i))
            Cursor.FIELD_TYPE_STRING -> putString(cursor.getColumnName(i), cursor.getString(i))
            else -> putString(cursor.getColumnName(i), "")
        }
    }
}

fun SQLiteDatabase.transaction(function: () -> Unit) {
    beginTransaction()
    try {
        function()
        setTransactionSuccessful()
    } finally {
        endTransaction()
    }
}
