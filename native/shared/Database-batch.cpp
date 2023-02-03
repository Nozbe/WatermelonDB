#include "Database.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

// TODO: Remove non-json batch once we can tell that there's no serious perf regression
void Database::batch(jsi::Array &operations) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);
    beginTransaction();

    std::vector<std::string> addedIds = {};
    std::vector<std::string> removedIds = {};

    try {
        size_t operationsCount = operations.length(rt);
        for (size_t i = 0; i < operationsCount; i++) {
            jsi::Array operation = operations.getValueAtIndex(rt, i).getObject(rt).getArray(rt);

            auto cacheBehavior = operation.getValueAtIndex(rt, 0).getNumber();
            auto table = cacheBehavior != 0 ? operation.getValueAtIndex(rt, 1).getString(rt).utf8(rt) : "";
            auto sql = operation.getValueAtIndex(rt, 2).getString(rt).utf8(rt);

            jsi::Array argsBatches = operation.getValueAtIndex(rt, 3).getObject(rt).getArray(rt);
            size_t argsBatchesCount = argsBatches.length(rt);
            for (size_t j = 0; j < argsBatchesCount; j++) {
                jsi::Array args = argsBatches.getValueAtIndex(rt, j).getObject(rt).getArray(rt);
                executeUpdate(sql, args);
                if (cacheBehavior != 0) {
                    auto id = args.getValueAtIndex(rt, 0).getString(rt).utf8(rt);
                    if (cacheBehavior == 1) {
                        addedIds.push_back(cacheKey(table, id));
                    } else if (cacheBehavior == -1) {
                        removedIds.push_back(cacheKey(table, id));
                    }
                }
            }

        }
        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }

    for (auto const &key : addedIds) {
        markAsCached(key);
    }

    for (auto const &key : removedIds) {
        removeFromCache(key);
    }
}

void Database::batchJSON(jsi::String &&jsiJson) {
    using namespace simdjson;

    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);
    beginTransaction();

    std::vector<std::string> addedIds = {};
    std::vector<std::string> removedIds = {};

    try {
        ondemand::parser parser;
        auto json = padded_string(jsiJson.utf8(rt));
        ondemand::document doc = parser.iterate(json);

        // NOTE: simdjson::ondemand processes forwards-only, hence the weird field enumeration
        // We can't use subscript or backtrack.
        for (ondemand::array operation : doc) {
            int64_t cacheBehavior = 0;
            std::string table;
            std::string sql;
            size_t fieldIdx = 0;
            for (auto field : operation) {
                if (fieldIdx == 0) {
                    cacheBehavior = field;
                } else if (fieldIdx == 1) {
                    if (cacheBehavior != 0) {
                        table = (std::string_view) field;
                    }
                } else if (fieldIdx == 2) {
                    sql = (std::string_view) field;
                } else if (fieldIdx == 3) {
                    ondemand::array argsBatches = field;
                    auto stmt = prepareQuery(sql);
                    SqliteStatement statement(stmt);

                    for (ondemand::array args : argsBatches) {
                        // NOTE: We must capture the ID once first parsed
                        auto id = bindArgsAndReturnId(stmt, args);
                        executeUpdate(stmt);
                        sqlite3_reset(stmt);
                        if (cacheBehavior == 1) {
                            addedIds.push_back(cacheKey(table, id));
                        } else if (cacheBehavior == -1) {
                            removedIds.push_back(cacheKey(table, id));
                        }
                    }
                }
                fieldIdx++;
            }
        }

        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }

    for (auto const &key : addedIds) {
        markAsCached(key);
    }

    for (auto const &key : removedIds) {
        removeFromCache(key);
    }
}

}
