LOCAL_PATH:= $(call my-dir)
include $(CLEAR_VARS)

# NOTE the following flags,
#   SQLITE_TEMP_STORE=3 causes all TEMP files to go into RAM. and thats the behavior we want
#   SQLITE_ENABLE_FTS3   enables usage of FTS3 - NOT FTS1 or 2.
#   SQLITE_DEFAULT_AUTOVACUUM=1  causes the databases to be subject to auto-vacuum
sqlite_flags := \
	-DNDEBUG=1 \
	-DHAVE_USLEEP=1 \
	-DSQLITE_HAVE_ISNAN \
	-DSQLITE_DEFAULT_JOURNAL_SIZE_LIMIT=1048576 \
	-DSQLITE_THREADSAFE=2 \
	-DSQLITE_TEMP_STORE=3 \
	-DSQLITE_POWERSAFE_OVERWRITE=1 \
	-DSQLITE_DEFAULT_FILE_FORMAT=4 \
	-DSQLITE_DEFAULT_AUTOVACUUM=1 \
	-DSQLITE_ENABLE_MEMORY_MANAGEMENT=1 \
	-DSQLITE_ENABLE_FTS3 \
	-DSQLITE_ENABLE_FTS3_PARENTHESIS \
	-DSQLITE_ENABLE_FTS4 \
    -DSQLITE_ENABLE_FTS4_PARENTHESIS \
    -DSQLITE_ENABLE_FTS5 \
    -DSQLITE_ENABLE_FTS5_PARENTHESIS \
	-DSQLITE_ENABLE_JSON1 \
	-DSQLITE_ENABLE_RTREE=1 \
	-DSQLITE_UNTESTABLE \
	-DSQLITE_OMIT_COMPILEOPTION_DIAGS \
	-DSQLITE_DEFAULT_FILE_PERMISSIONS=0600 \
    -DSQLITE_DEFAULT_MEMSTATUS=0 \
    -DSQLITE_MAX_EXPR_DEPTH=0 \
    -DSQLITE_USE_ALLOCA \
    -DSQLITE_ENABLE_BATCH_ATOMIC_WRITE \
    -O3

LOCAL_CFLAGS += $(sqlite_flags)
LOCAL_CFLAGS += -Wno-unused-parameter -Wno-int-to-pointer-cast
LOCAL_CFLAGS += -Wno-uninitialized -Wno-parentheses
LOCAL_CPPFLAGS += -Wno-conversion-null


ifeq ($(TARGET_ARCH), arm)
	LOCAL_CFLAGS += -DPACKED="__attribute__ ((packed))"
else
	LOCAL_CFLAGS += -DPACKED=""
endif

LOCAL_SRC_FILES:= \
	android_database_SQLiteCommon.cpp \
	android_database_SQLiteConnection.cpp \
	android_database_SQLiteFunction.cpp \
	android_database_SQLiteGlobal.cpp \
	android_database_SQLiteDebug.cpp \
	android_database_CursorWindow.cpp \
	CursorWindow.cpp \
	JNIHelp.cpp \
	JNIString.cpp

LOCAL_SRC_FILES += sqlite3.c

LOCAL_C_INCLUDES += $(LOCAL_PATH)

LOCAL_MODULE:= libsqlite3x
LOCAL_LDLIBS += -ldl -llog -latomic

include $(BUILD_SHARED_LIBRARY)

