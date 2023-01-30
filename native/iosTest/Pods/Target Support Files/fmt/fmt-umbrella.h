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

#import "fmt/chrono.h"
#import "fmt/color.h"
#import "fmt/compile.h"
#import "fmt/core.h"
#import "fmt/format-inl.h"
#import "fmt/format.h"
#import "fmt/locale.h"
#import "fmt/os.h"
#import "fmt/ostream.h"
#import "fmt/posix.h"
#import "fmt/printf.h"
#import "fmt/ranges.h"

FOUNDATION_EXPORT double fmtVersionNumber;
FOUNDATION_EXPORT const unsigned char fmtVersionString[];

