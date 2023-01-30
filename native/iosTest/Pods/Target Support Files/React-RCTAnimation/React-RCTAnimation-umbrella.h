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

#import "RCTAnimationDriver.h"
#import "RCTDecayAnimation.h"
#import "RCTEventAnimation.h"
#import "RCTFrameAnimation.h"
#import "RCTSpringAnimation.h"
#import "RCTAdditionAnimatedNode.h"
#import "RCTAnimatedNode.h"
#import "RCTColorAnimatedNode.h"
#import "RCTDiffClampAnimatedNode.h"
#import "RCTDivisionAnimatedNode.h"
#import "RCTInterpolationAnimatedNode.h"
#import "RCTModuloAnimatedNode.h"
#import "RCTMultiplicationAnimatedNode.h"
#import "RCTPropsAnimatedNode.h"
#import "RCTStyleAnimatedNode.h"
#import "RCTSubtractionAnimatedNode.h"
#import "RCTTrackingAnimatedNode.h"
#import "RCTTransformAnimatedNode.h"
#import "RCTValueAnimatedNode.h"
#import "RCTAnimationPlugins.h"
#import "RCTAnimationUtils.h"
#import "RCTNativeAnimatedModule.h"
#import "RCTNativeAnimatedNodesManager.h"
#import "RCTNativeAnimatedTurboModule.h"

FOUNDATION_EXPORT double RCTAnimationVersionNumber;
FOUNDATION_EXPORT const unsigned char RCTAnimationVersionString[];

