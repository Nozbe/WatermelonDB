#pragma once

#import <React/RCTBridge+Private.h>

#ifdef __cplusplus
extern "C"
{
#endif

void installWatermelonJSI(RCTCxxBridge *bridge);
void watermelondbProvideSyncJson(int id, NSData *json, NSError **errorPtr);

#ifdef __cplusplus
} // extern "C"
#endif
