#pragma once

#include <jsi/jsi.h>

void watermelonCallWithJSCLockHolder(facebook::jsi::Runtime& rt, std::function<void (void)> block);
