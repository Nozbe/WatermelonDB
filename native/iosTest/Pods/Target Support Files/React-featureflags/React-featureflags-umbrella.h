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

#import "react/featureflags/ReactNativeFeatureFlags.h"
#import "react/featureflags/ReactNativeFeatureFlagsAccessor.h"
#import "react/featureflags/ReactNativeFeatureFlagsDefaults.h"
#import "react/featureflags/ReactNativeFeatureFlagsProvider.h"

FOUNDATION_EXPORT double react_featureflagsVersionNumber;
FOUNDATION_EXPORT const unsigned char react_featureflagsVersionString[];

