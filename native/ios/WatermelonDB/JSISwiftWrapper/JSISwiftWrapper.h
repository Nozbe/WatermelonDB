//
//  JSISwiftWrapper.h
//  WatermelonDB
//
//  Created by BuildOpsLA27 on 9/27/24.
//  Copyright © 2024 Nozbe. All rights reserved.
//

#ifndef JSISwiftWrapper_h
#define JSISwiftWrapper_h

#include <mutex>
#import <jsi/jsi.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import "WatermelonDB-Swift.h"

using namespace facebook;

namespace watermelondb {

class SwiftBridge : public jsi::HostObject {
public:
    static void install(jsi::Runtime *runtime, DatabaseBridge *databaseBridge);
    
    SwiftBridge(jsi::Runtime *runtime, DatabaseBridge *databaseBridge);
    ~SwiftBridge();
    
    jsi::Value execSqlQuery(const jsi::Value &tag, const jsi::String &sql, const jsi::Array &arguments);
    jsi::Value query(const jsi::Value &tag, const jsi::String &table, const jsi::String &query);
    
private:
    DatabaseBridge *databaseBridge_;
    
    std::mutex mutex_;
    
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
};

} // namespace watermelondb


#endif /* JSISwiftWrapper_h */
