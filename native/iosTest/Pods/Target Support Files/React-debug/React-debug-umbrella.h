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

#import "react/debug/flags.h"
#import "react/debug/react_native_assert.h"
#import "react/debug/react_native_expect.h"

FOUNDATION_EXPORT double react_debugVersionNumber;
FOUNDATION_EXPORT const unsigned char react_debugVersionString[];

