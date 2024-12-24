//
//  DatabaseUtils.hpp
//  WatermelonDB
//
//  Created by BuildOpsLA27 on 10/4/24.
//

#ifndef DatabaseUtils_hpp
#define DatabaseUtils_hpp

#import <jsi/jsi.h>
#import <unordered_map>
#import <unordered_set>
#import <sqlite3.h>

#import "Sqlite.h"

using namespace facebook;

namespace watermelondb {

sqlite3_stmt* getStmt(jsi::Runtime &rt, sqlite3* db, std::string sql, const jsi::Array &arguments);

void finalizeStmt(sqlite3_stmt* stmt);

jsi::Array arrayFromStd(jsi::Runtime &rt, std::vector<jsi::Value> &vector);

jsi::Object resultDictionary(jsi::Runtime &rt, sqlite3_stmt *statement);

bool getNextRowOrTrue(jsi::Runtime &rt, sqlite3_stmt *stmt);

}
#endif /* DatabaseUtils_hpp */
