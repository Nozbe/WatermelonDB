#pragma once

#import <React/RCTBridge+Private.h>

#ifdef __cplusplus
extern "C"
{
#endif

void installWatermelonJSI(RCTCxxBridge *bridge);
void provideJson(int tag, NSData *json);

#ifdef __cplusplus
} // extern "C"

#import <string>
std::string_view consumeJson(int tag);
#endif
