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

#import "evdns.h"
#import "event.h"
#import "evhttp.h"
#import "evrpc.h"
#import "evutil.h"

FOUNDATION_EXPORT double libeventVersionNumber;
FOUNDATION_EXPORT const unsigned char libeventVersionString[];

