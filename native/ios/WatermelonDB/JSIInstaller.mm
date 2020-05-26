#import "JSIInstaller.h"
#import "Database.h"

extern "C" void installWatermelonJSI(RCTCxxBridge *bridge) {
    if (bridge.runtime == nullptr) {
        return;
    }

    jsi::Runtime *runtime = (jsi::Runtime*) bridge.runtime;
    watermelondb::Database::install(runtime);
}
