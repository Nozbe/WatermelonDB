#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

enum ColumnType { string, number, boolean };
struct ColumnSchema {
    int index;
    std::string name;
    ColumnType type;
    bool isOptional;
};

ColumnType columnTypeFromStr(std::string &type) {
    if (type == "string") {
        return ColumnType::string;
    } else if (type == "number") {
        return ColumnType::number;
    } else if (type == "boolean") {
        return ColumnType::boolean;
    } else {
        throw std::invalid_argument("invalid column type in schema");
    }
}

using TableSchemaArray = std::vector<ColumnSchema>;
using TableSchema = std::unordered_map<std::string, ColumnSchema>;
std::pair<TableSchemaArray, TableSchema> decodeTableSchema(jsi::Runtime &rt, jsi::Object schema) {
    auto columnArr = schema.getProperty(rt, "columnArray").getObject(rt).getArray(rt);

    TableSchemaArray columnsArray = {};
    TableSchema columns = {};

    for (size_t i = 0, len = columnArr.size(rt); i < len; i++) {
        auto columnObj = columnArr.getValueAtIndex(rt, i).getObject(rt);
        auto name = columnObj.getProperty(rt, "name").getString(rt).utf8(rt);
        auto typeStr = columnObj.getProperty(rt, "type").getString(rt).utf8(rt);
        ColumnType type = columnTypeFromStr(typeStr);
        auto isOptionalProp = columnObj.getProperty(rt, "isOptional");
        bool isOptional = isOptionalProp.isBool() ? isOptionalProp.getBool() : false;
        ColumnSchema column = { (int) i, name, type, isOptional };

        columnsArray.push_back(column);
        columns[name] = column;
    }

    return std::make_pair(columnsArray, columns);
}

std::string insertSqlFor(jsi::Runtime &rt, std::string tableName, TableSchemaArray columns) {
    std::string sql = "insert into `" + tableName + "` (`id`, `_status`, `_changed";
    for (auto const &column : columns) {
        sql += "`, `" + column.name;
    }
    sql += "`) values (?, 'synced', ''";
    for (size_t i = 0, len = columns.size(); i < len; i++) {
        sql += ", ?";
    }
    sql += ")";
    return sql;
}

jsi::Value Database::unsafeLoadFromSync(int jsonId, jsi::Object &schema, std::string preamble, std::string postamble) {
    using namespace simdjson;
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);
    beginTransaction();

    try {
        executeMultiple(preamble);

        jsi::Object residualValues(rt);
        auto tableSchemas = schema.getProperty(rt, "tables").getObject(rt);

        ondemand::parser parser;
        auto json = padded_string(platform::getSyncJson(jsonId));
        ondemand::document doc = parser.iterate(json);

        // NOTE: simdjson::ondemand processes forwards-only, hence the weird field enumeration
        // We can't use subscript or backtrack.
        for (auto docField : (ondemand::object) doc) {
            std::string_view fieldNameView = docField.unescaped_key();

            if (fieldNameView != "changes") {
                ondemand::value value = docField.value();
                std::string_view valueJson = simdjson::to_json_string(value);
                residualValues.setProperty(rt,
                                           jsi::String::createFromUtf8(rt, (std::string) fieldNameView),
                                           jsi::String::createFromUtf8(rt, (std::string) valueJson));
            } else {
                ondemand::object changeSet = docField.value();
                for (auto changeSetField : changeSet) {
                    auto tableName = (std::string) (std::string_view) changeSetField.unescaped_key();
                    ondemand::object tableChangeSet = changeSetField.value();

                    for (auto tableChangeSetField : tableChangeSet) {
                        std::string_view tableChangeSetKey = tableChangeSetField.unescaped_key();
                        ondemand::array records = tableChangeSetField.value();

                        if (tableChangeSetKey == "deleted") {
                            if (records.begin() != records.end()) {
                                throw jsi::JSError(rt, "expected deleted field to be empty");
                            }
                            continue;
                        } else if (tableChangeSetKey != "updated" && tableChangeSetKey != "created") {
                            throw jsi::JSError(rt, "bad changeset field");
                        }

                        auto tableSchemaJsi = tableSchemas.getProperty(rt, jsi::String::createFromUtf8(rt, tableName));
                        if (!tableSchemaJsi.isObject()) {
                            continue;
                        }
                        auto tableSchemas = decodeTableSchema(rt, tableSchemaJsi.getObject(rt));
                        auto tableSchemaArray = tableSchemas.first;
                        auto tableSchema = tableSchemas.second;

                        sqlite3_stmt *stmt = prepareQuery(insertSqlFor(rt, tableName, tableSchemaArray));
                        SqliteStatement statement(stmt);

                        for (ondemand::object record : records) {
                            // TODO: It would be much more natural to iterate over schema, and then get json's field
                            // and not the other way around, but simdjson doesn't allow us to do that right now
                            // I think 1.0 will allow subscripting objects even if it means backtracking
                            // So we need this stupid hack where we pre-bind null/0/false/'' to sanitize missing fields
                            for (auto column : tableSchemaArray) {
                                auto argumentsIdx = column.index + 2;
                                if (column.isOptional) {
                                    sqlite3_bind_null(stmt, argumentsIdx);
                                } else {
                                    if (column.type == ColumnType::string) {
                                        sqlite3_bind_text(stmt, argumentsIdx, "", -1, SQLITE_STATIC);
                                    } else if (column.type == ColumnType::boolean) {
                                        sqlite3_bind_int(stmt, argumentsIdx, 0);
                                    } else if (column.type == ColumnType::number) {
                                        sqlite3_bind_double(stmt, argumentsIdx, 0);
                                    } else {
                                        throw jsi::JSError(rt, "Unknown schema type");
                                    }
                                }
                            }

                            for (auto valueField : record) {
                                auto key = (std::string) (std::string_view) valueField.unescaped_key();
                                auto value = valueField.value();

                                if (key == "id") {
                                    std::string_view idView = value;
                                    sqlite3_bind_text(stmt, 1, idView.data(), (int) idView.length(), SQLITE_STATIC);
                                    continue;
                                }

                                try {
                                    auto &column = tableSchema.at(key);
                                    ondemand::json_type type = value.type();
                                    auto argumentsIdx = column.index + 2;

                                    if (column.type == ColumnType::string && type == ondemand::json_type::string) {
                                        std::string_view stringView = value;
                                        sqlite3_bind_text(stmt, argumentsIdx, stringView.data(), (int) stringView.length(), SQLITE_STATIC);
                                    } else if (column.type == ColumnType::boolean) {
                                        if (type == ondemand::json_type::boolean) {
                                            sqlite3_bind_int(stmt, argumentsIdx, (bool) value);
                                        } else if (type == ondemand::json_type::number && ((double) value == 0 || (double) value == 1)) {
                                            sqlite3_bind_int(stmt, argumentsIdx, (bool) (double) value); // needed for compat with sanitizeRaw
                                        }
                                    } else if (column.type == ColumnType::number && type == ondemand::json_type::number) {
                                        sqlite3_bind_double(stmt, argumentsIdx, (double) value);
                                    }
                                } catch (const std::out_of_range &ex) {
                                    continue;
                                }
                            }

                            executeUpdate(stmt);
                            sqlite3_reset(stmt);
                        }
                    }
                }
            }
        }
        executeMultiple(postamble);
        commit();
        platform::deleteSyncJson(jsonId);
        return residualValues;
    } catch (const std::exception &ex) {
        platform::deleteSyncJson(jsonId);
        rollback();
        throw;
    }
}

}
