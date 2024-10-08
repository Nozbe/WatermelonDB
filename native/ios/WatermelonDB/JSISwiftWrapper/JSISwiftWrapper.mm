//
//  JSISwiftWrapper.mm
//  WatermelonDB
//
//  Created by BuildOpsLA27 on 9/27/24.
//  Copyright © 2024 Nozbe. All rights reserved.
//

#include "JSISwiftWrapper.h"
#include "DatabaseUtils.h"
#include <string>

namespace watermelondb {

SwiftBridge::SwiftBridge(jsi::Runtime *runtime, DatabaseBridge *databaseBridge)
: runtime_(runtime), databaseBridge_(databaseBridge ) {
    
}

SwiftBridge::~SwiftBridge() {
    
}

jsi::Value SwiftBridge::query(const jsi::Value &tag, const jsi::String &table, const jsi::String &query) {
    auto tagNumber = [[NSNumber alloc] initWithDouble:tag.asNumber()];
    auto tableStr = [NSString stringWithUTF8String:table.utf8(*runtime_).c_str()];
    
    auto db = [databaseBridge_ getRawConnectionWithConnectionTag:tagNumber];
    
    const std::lock_guard<std::mutex> lock(mutex_);
    
    auto statement = getStmt(*runtime_, static_cast<sqlite3*>(db), query.utf8(*runtime_), jsi::Array(*runtime_, 0));
    
    std::vector<jsi::Value> records = {};
    
    while (true) {
        if (getNextRowOrTrue(*runtime_, statement.stmt)) {
            break;
        }
        
        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");
        
        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        
        if (!id) {
            throw jsi::JSError(*runtime_, "Failed to get ID of a record");
        }
        
        auto idStr = [NSString stringWithUTF8String:id];
                
        bool isCached = [databaseBridge_ isCachedWithConnectionTag:tagNumber table:tableStr id:idStr];
        
        if (isCached) {
            jsi::String jsiId = jsi::String::createFromAscii(*runtime_, id);
            records.push_back(std::move(jsiId));
        } else {
            [databaseBridge_ markAsCachedWithConnectionTag:tagNumber table:tableStr id:idStr];
            jsi::Object record = resultDictionary(*runtime_, statement.stmt);
            records.push_back(std::move(record));
        }
    }
    
    return arrayFromStd(*runtime_, records);
}

jsi::Value SwiftBridge::execSqlQuery(const jsi::Value &tag, const jsi::String &sql, const jsi::Array &arguments) {
    auto tagNumber = [[NSNumber alloc] initWithDouble:tag.asNumber()];
    
    auto db = [databaseBridge_ getRawConnectionWithConnectionTag:tagNumber];
    
    const std::lock_guard<std::mutex> lock(mutex_);
    
    auto statement = getStmt(*runtime_, static_cast<sqlite3*>(db), sql.utf8(*runtime_), arguments);
    
    std::vector<jsi::Value> records = {};
    
    while (true) {
        if (getNextRowOrTrue(*runtime_, statement.stmt)) {
            break;
        }
        
        jsi::Object record = resultDictionary(*runtime_, statement.stmt);
        
        records.push_back(std::move(record));
    }
    
    return arrayFromStd(*runtime_, records);
}

void SwiftBridge::install(jsi::Runtime *runtime, DatabaseBridge *databaseBridge) {
    // Create an instance of SwiftBridge
    auto swiftBridge = std::make_shared<SwiftBridge>(runtime, databaseBridge);
    
    if (!runtime->global().hasProperty(*runtime, "WatermelonDB")) {
        jsi::Object watermelonDB = jsi::Object(*runtime);
        runtime->global().setProperty(*runtime, "WatermelonDB", std::move(watermelonDB));
    }
    
    // Define the execSqlQuery function for JSI
    auto execSqlQueryFunc = jsi::Function::createFromHostFunction(
                                                                  *runtime,
                                                                  jsi::PropNameID::forAscii(*runtime, "execSqlQuery"),
                                                                  3,  // Number of arguments
                                                                  [swiftBridge](jsi::Runtime &rt, const jsi::Value &thisValue, const jsi::Value *args, size_t count) -> jsi::Value {
                                                                      if (count != 3) {
                                                                          throw jsi::JSError(rt, "execSqlQuery expects exactly 3 arguments.");
                                                                      }
                                                                      
                                                                      
                                                                      // Call the execSqlQuery function from SwiftBridge
                                                                      return swiftBridge->execSqlQuery(args[0], args[1].asString(rt), args[2].asObject(rt).asArray(rt));
                                                                  }
                                                                  );
    
    auto queryFunc = jsi::Function::createFromHostFunction(
                                                           *runtime,
                                                           jsi::PropNameID::forAscii(*runtime, "query"),
                                                           3,  // Number of arguments
                                                           [swiftBridge](jsi::Runtime &rt, const jsi::Value &thisValue, const jsi::Value *args, size_t count) -> jsi::Value {
                                                               if (count != 3) {
                                                                   throw jsi::JSError(rt, "query expects exactly 3 arguments.");
                                                               }
                                                               
                                                               
                                                               // Call the execSqlQuery function from SwiftBridge
                                                               return swiftBridge->query(args[0], args[1].asString(rt), args[2].asString(rt));
                                                           }
                                                           );
    
    
    // Set the functions in the global object
    
    runtime->global()
        .getPropertyAsObject(*runtime, "WatermelonDB")
        .setProperty(*runtime, "execSqlQuery", std::move(execSqlQueryFunc));
    
    runtime->global()
        .getPropertyAsObject(*runtime, "WatermelonDB")
        .setProperty(*runtime, "query", std::move(queryFunc));
}

}

