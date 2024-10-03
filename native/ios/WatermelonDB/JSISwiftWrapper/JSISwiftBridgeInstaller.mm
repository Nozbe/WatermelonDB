//
//  JSISwiftBridgeInstaller.m
//  WatermelonDB
//
//  Created by BuildOpsLA27 on 9/27/24.
//

#import <Foundation/Foundation.h>
#import "JSISwiftBridgeInstaller.h"
#import "JSISwiftWrapper.h"

extern "C" void installWatermelonJSISwiftBridge(RCTCxxBridge *bridge, void *databaseBridge) {
    if (bridge.runtime == nullptr) {
        return;
    }
    
    jsi::Runtime *runtime = (jsi::Runtime*) bridge.runtime;
    
    assert(runtime != nullptr);
    assert(databaseBridge != nullptr);
    
    watermelondb::SwiftBridge::install(runtime, (__bridge DatabaseBridge *) databaseBridge);
}

