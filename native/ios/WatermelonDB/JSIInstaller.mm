#import "JSIInstaller.h"
#import "Database.h"

// React Native 0.88 removed RCTCxxBridge (and its declaration in RCTBridge+Private.h).
// Both the legacy RCTCxxBridge and the bridgeless RCTBridgeProxy still respond to -runtime,
// so the installer takes a plain RCTBridge and declares the selector itself.
@interface RCTBridge (WatermelonJSIRuntime)
- (void *)runtime;
@end

extern "C" void installWatermelonJSI(RCTBridge *bridge) {
    if (bridge.runtime == nullptr) {
        return;
    }

    jsi::Runtime *runtime = (jsi::Runtime*) bridge.runtime;
    assert(runtime != nullptr);
    watermelondb::Database::install(runtime);
}
