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

#import "react/renderer/debug/DebugStringConvertible.h"
#import "react/renderer/debug/DebugStringConvertibleItem.h"
#import "react/renderer/debug/debugStringConvertibleUtils.h"
#import "react/renderer/debug/flags.h"
#import "react/renderer/debug/SystraceSection.h"

FOUNDATION_EXPORT double react_renderer_debugVersionNumber;
FOUNDATION_EXPORT const unsigned char react_renderer_debugVersionString[];

