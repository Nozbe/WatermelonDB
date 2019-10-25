#pragma once

#import <jsi/jsi.h>
#import <sqlite3.h>

using namespace facebook;

namespace watermelondb {

class Database : public jsi::HostObject {

private:
    sqlite3 *db_;

    void executeUpdate(jsi::Runtime& rt, jsi::String sql, jsi::Array arguments);
    void batch(jsi::Runtime& runtime, jsi::Array& operations);
};

} // namespace watermelondb
