#pragma once

#import <jsi/jsi.h>
#import "MelonModule.h"

using namespace facebook;

class JSI_EXPORT MelonModuleJSI : public jsi::HostObject {
public:
    // Installs TestBinding into JavaSctipt runtime.
    // Thread synchronization must be enforced externally.
    static void install(MelonModule* melonModule);

    MelonModuleJSI(MelonModule* melonModule);

    // `jsi::HostObject` specific overloads.
    jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &name) override;

private:
    MelonModule* melonModule_;
};
