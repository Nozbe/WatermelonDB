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

#import "react/renderer/imagemanager/RCTImageManager.h"
#import "react/renderer/imagemanager/RCTImageManagerProtocol.h"
#import "react/renderer/imagemanager/RCTImagePrimitivesConversions.h"
#import "react/renderer/imagemanager/RCTSyncImageManager.h"

FOUNDATION_EXPORT double react_renderer_imagemanagerVersionNumber;
FOUNDATION_EXPORT const unsigned char react_renderer_imagemanagerVersionString[];

