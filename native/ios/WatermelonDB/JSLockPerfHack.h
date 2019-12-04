#pragma once

#include <jsi/jsi.h>

void callWithJSCLockHolder(facebook::jsi::Runtime& rt, std::function<void (void)> block);
