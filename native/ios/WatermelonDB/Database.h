#pragma once

#import <jsi/jsi.h>
#import <sqlite3.h>

using namespace facebook;

namespace watermelondb {

class Database : public jsi::HostObject {
public:
    static void install(jsi::Runtime *runtime);
    Database(jsi::Runtime *runtime);
    ~Database();

private:
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
    sqlite3 *db_;

    void executeUpdate(jsi::Runtime& rt, jsi::String&& sql, jsi::Array&& arguments);
    void batch(jsi::Runtime& runtime, jsi::Array& operations);
};

} // namespace watermelondb
