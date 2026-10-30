#pragma once

#import <React/RCTBridge.h>

#ifdef __cplusplus
extern "C"
{
#endif

void installWatermelonJSI(RCTBridge *bridge);
void watermelondbProvideSyncJson(int id, NSData *json, NSError **errorPtr);

#ifdef __cplusplus
} // extern "C"
#endif
