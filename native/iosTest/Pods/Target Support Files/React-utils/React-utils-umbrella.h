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

#import "react/utils/CalledOnceMovableOnlyFunction.h"
#import "react/utils/ContextContainer.h"
#import "react/utils/CoreFeatures.h"
#import "react/utils/FloatComparison.h"
#import "react/utils/hash_combine.h"
#import "react/utils/ManagedObjectWrapper.h"
#import "react/utils/RunLoopObserver.h"
#import "react/utils/SharedFunction.h"
#import "react/utils/SimpleThreadSafeCache.h"
#import "react/utils/Telemetry.h"

FOUNDATION_EXPORT double react_utilsVersionNumber;
FOUNDATION_EXPORT const unsigned char react_utilsVersionString[];

