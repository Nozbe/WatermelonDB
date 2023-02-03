#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

jsi::Value Database::find(jsi::String &tableName, jsi::String &id) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    if (isCached(cacheKey(tableName.utf8(rt), id.utf8(rt)))) {
        return std::move(id);
    }

    auto args = jsi::Array::createWithElements(rt, id);
    auto statement = executeQuery("select * from `" + tableName.utf8(rt) + "` where id == ? limit 1", args);

    if (getNextRowOrTrue(statement.stmt)) {
        return jsi::Value::null();
    }

    auto record = resultDictionary(statement.stmt);

    markAsCached(cacheKey(tableName.utf8(rt), id.utf8(rt)));

    return record;
}

jsi::Value Database::query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    auto statement = executeQuery(sql.utf8(rt), arguments);
    std::vector<jsi::Value> records = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            jsi::String jsiId = jsi::String::createFromAscii(rt, id);
            records.push_back(std::move(jsiId));
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            jsi::Object record = resultDictionary(statement.stmt);
            records.push_back(std::move(record));
        }
    }

    return arrayFromStd(records);
}

jsi::Value Database::queryAsArray(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    auto statement = executeQuery(sql.utf8(rt), arguments);
    std::vector<jsi::Value> results = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        if (results.size() == 0) {
            jsi::Array columns = resultColumns(statement.stmt);
            results.push_back(std::move(columns));
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            jsi::String jsiId = jsi::String::createFromAscii(rt, id);
            results.push_back(std::move(jsiId));
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            jsi::Array record = resultArray(statement.stmt);
            results.push_back(std::move(record));
        }
    }

    return arrayFromStd(results);
}

jsi::Array Database::queryIds(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    auto statement = executeQuery(sql.utf8(rt), arguments);
    std::vector<jsi::Value> ids = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *idText = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!idText) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        jsi::String id = jsi::String::createFromAscii(rt, idText);
        ids.push_back(std::move(id));
    }

    return arrayFromStd(ids);
}

jsi::Array Database::unsafeQueryRaw(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    auto statement = executeQuery(sql.utf8(rt), arguments);
    std::vector<jsi::Value> raws = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        jsi::Object raw = resultDictionary(statement.stmt);
        raws.push_back(std::move(raw));
    }

    return arrayFromStd(raws);
}

jsi::Value Database::count(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    auto statement = executeQuery(sql.utf8(rt), arguments);
    getRow(statement.stmt);

    assert(sqlite3_data_count(statement.stmt) == 1);
    int count = sqlite3_column_int(statement.stmt, 0);
    return jsi::Value(count);
}

jsi::Value Database::getLocal(jsi::String &key) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    auto args = jsi::Array::createWithElements(rt, key);
    auto statement = executeQuery("select value from local_storage where key = ?", args);

    if (getNextRowOrTrue(statement.stmt)) {
        return jsi::Value::null();
    }

    assert(sqlite3_data_count(statement.stmt) == 1);
    const char *text = (const char *)sqlite3_column_text(statement.stmt, 0);

    if (!text) {
        return jsi::Value::null();
    }

    return jsi::String::createFromUtf8(rt, text);
}

}
