package com.nozbe.watermelondb

import android.database.Cursor
import com.facebook.react.bridge.WritableMap

typealias SQL = String
typealias RecordID = String
typealias TableName = String
typealias QueryArgs = Array<Any?>
typealias RawQueryArgs = Array<String>
typealias ConnectionTag = Int
typealias SchemaVersion = Int