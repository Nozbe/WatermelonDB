#include "JSLockPerfHack.h"

using namespace facebook;

void watermelonCallWithJSCLockHolder(jsi::Runtime &rt, std::function<void(void)> block) {
    // dummy stub
    block();
}
