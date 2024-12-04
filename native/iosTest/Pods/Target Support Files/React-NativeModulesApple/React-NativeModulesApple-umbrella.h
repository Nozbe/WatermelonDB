#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "ReactCommon/RCTInteropTurboModule.h"
#import "ReactCommon/RCTRuntimeExecutor.h"
#import "ReactCommon/RCTTurboModule.h"
#import "ReactCommon/RCTTurboModuleManager.h"

FOUNDATION_EXPORT double React_NativeModulesAppleVersionNumber;
FOUNDATION_EXPORT const unsigned char React_NativeModulesAppleVersionString[];

