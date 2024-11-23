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

#import "double-conversion/bignum-dtoa.h"
#import "double-conversion/bignum.h"
#import "double-conversion/cached-powers.h"
#import "double-conversion/diy-fp.h"
#import "double-conversion/double-conversion.h"
#import "double-conversion/fast-dtoa.h"
#import "double-conversion/fixed-dtoa.h"
#import "double-conversion/ieee.h"
#import "double-conversion/strtod.h"
#import "double-conversion/utils.h"

FOUNDATION_EXPORT double DoubleConversionVersionNumber;
FOUNDATION_EXPORT const unsigned char DoubleConversionVersionString[];

