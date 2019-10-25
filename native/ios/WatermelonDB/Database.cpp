#include "Database.h"

namespace watermelondb {

void Database::executeUpdate(jsi::Runtime& rt, jsi::String&& sql, jsi::Array&& arguments) {
    sqlite3_stmt *statement = nullptr;
    int resultPrepare = sqlite3_prepare_v2(db_, sql.utf8(rt).c_str(), -1, &statement, nullptr);

    if (resultPrepare != SQLITE_OK) {
        std::abort(); // Unimplemented
    }

    int argsCount = sqlite3_bind_parameter_count(statement);

    if (argsCount != arguments.length(rt)) {
        std::abort(); // Unimplemented
    }

    for (int i = 0; i < argsCount; i++) {
        jsi::Value value = arguments.getValueAtIndex(rt, i);

        int bindResult;
        if (value.isNull()) {
            bindResult = sqlite3_bind_null(statement, i);
        } else if (value.isString()) {
            // TODO: Check SQLITE_STATIC
            bindResult = sqlite3_bind_text(statement, i, value.getString(rt).utf8(rt).c_str(), -1, SQLITE_STATIC);
        } else if (value.isNumber()) {
            // TODO: Ints?
            bindResult = sqlite3_bind_double(statement, i, value.getNumber());
        } else {
            std::abort(); // Unimplemented
        }

        if (bindResult != SQLITE_OK) {
            std::abort(); // Unimplemented
        }
    }

    int resultStep = sqlite3_step(statement);

    if (resultStep != SQLITE_OK) {
        std::abort(); // Unimplemented
    }

    int resultFinalize = sqlite3_finalize(statement);

    if (resultFinalize != SQLITE_OK) {
        std::abort(); // Unimplemented
    }
}

void Database::batch(jsi::Runtime& rt, jsi::Array& operations) {
    size_t operationsCount = operations.length(rt);
    for (size_t i = 0; i < operationsCount; i++) {
        jsi::Array operation = operations.getValueAtIndex(rt, i).asObject(rt).asArray(rt);
        std::string type = operation.getValueAtIndex(rt, 0).asString(rt).utf8(rt);

        if (type == "create") {
            std::string table = operation.getValueAtIndex(rt, 1).asString(rt).utf8(rt);
            std::string id = operation.getValueAtIndex(rt, 2).asString(rt).utf8(rt);
            jsi::String sql = operation.getValueAtIndex(rt, 3).asString(rt);
            jsi::Array arguments = operation.getValueAtIndex(rt, 4).asObject(rt).asArray(rt);

            executeUpdate(rt, std::move(sql), std::move(arguments));
        } else if (type == "execute") {
            throw jsi::JSError(rt, "Unimplemented");
        } else if (type == "markAsDeleted") {
            throw jsi::JSError(rt, "Unimplemented");
        } else if (type == "destroyPermanently") {
            throw jsi::JSError(rt, "Unimplemented");
        } else {
            throw jsi::JSError(rt, "Invalid operation type");
        }
    }
}

} // namespace watermelondb
