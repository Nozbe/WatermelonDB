#include "JSLockPerfHack.h"
#include <jsi/JSCRuntime.h>

using namespace facebook;

void watermelonCallWithJSCLockHolder(jsi::Runtime &rt, std::function<void(void)> block) {
    // dummy stub
    block();
}
