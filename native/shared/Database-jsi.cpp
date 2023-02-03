#include "Database.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

jsi::Runtime &Database::getRt() {
    return *runtime_;
}

jsi::JSError Database::dbError(std::string description) {
    // TODO: In serialized threading mode, those may be incorrect - probably smarter to pass result codes around?
    auto sqliteMessage = std::string(sqlite3_errmsg(db_->sqlite));
    auto code = sqlite3_extended_errcode(db_->sqlite);
    auto message = description + " - sqlite error " + std::to_string(code) + " (" + sqliteMessage + ")";
    // Note: logging to console in case another exception is thrown so that the original error isn't lost
    consoleError(message);

    auto &rt = getRt();
    return jsi::JSError(rt, message);
}

jsi::Array Database::arrayFromStd(std::vector<jsi::Value> &vector) {
    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    auto &rt = getRt();
    jsi::Array array(rt, vector.size());
    size_t i = 0;
    for (auto const &value : vector) {
        array.setValueAtIndex(rt, i, value);
        i++;
    }
    return array;
}

}
