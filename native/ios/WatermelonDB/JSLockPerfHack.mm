#import "JSLockPerfHack.h"
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <jsi/JSCRuntime.h>
#import <objc/runtime.h>
#import <objc/message.h>

using namespace facebook;

// Performance hack:
//
// All JavaScriptCore APIs (both C and ObjC) are wrapped in an "API lock"
// (I think this prevents concurrent access to JSC's VM)
// using a JSLockHolder, like here:
// https://github.com/WebKit/webkit/blob/64dc0d1354d65e0cb3e42294429275a0d3b7209d/Source/JavaScriptCore/API/JSValueRef.cpp#L65
//
// This creates a JSLock: https://github.com/WebKit/webkit/blob/64dc0d1354d65e0cb3e42294429275a0d3b7209d/Source/JavaScriptCore/runtime/JSLock.cpp#L102-L128
// Locking is expensive — converting an array of 30K small arrays might invove a million API operations, taking up
// hundreds of milliseconds, most of which is spent/wasted locking and unlocking.
//
// In the ideal world, there would be a C API for explicit API locking, but there is none:
// https://bugs.webkit.org/show_bug.cgi?id=203463
//
// Wrapping the whole set of operations with a JSLockHolder cuts the overhead dramatically, because locking is skipped
// if there's already a lock on current thread. (There's still real overhead, but a lot less). But on iOS, this is a
// private API.
//
// So we're doing a dangerous thing which is to swizzle interesting parts of the JSC ObjC API to call our code within a
// block that already contains a JSLockHolder. This is terrible, and may break at any moment. The hack will automatically
// disable itself with every major iOS release to avoid breakage - must be manually reenabled, and has fallbacks for every
// broken assumption I could think of.
//
// 2021 update:
// - explicit JSLock() / JSUnlock() APIs have been added, but are private
//   https://github.com/WebKit/WebKit/commit/7993925814478740bb1ac9798d6ef947e9103e0c#diff-3486ee6539c9411128b1c4c0a4f6cc960516f258f9820592ac16bacc9eba2297
// - JSLockHolder renamed to Locker
// - Removed unnecessary locking from a few APIs
//   https://github.com/WebKit/WebKit/commit/03a825dad22db819967f3b19e00d3ac23ec31d2b#diff-a001581271f7e2b5dbace303c1a9a1d39b0a183c43dd63a7951cb4f57b42163d
//
// To enable this hack, pass -DENABLE_JSLOCK_PERFORMANCE_HACK compiler flag

#ifdef ENABLE_JSLOCK_PERFORMANCE_HACK

namespace watermelondb {
std::function<void (void)> *blockToExecute = nullptr;
bool didBlockExecuteUsingHack = false;

void perfhackFail(NSString *whytho) {
    static bool didWarn = false;
    if (!didWarn) {
        NSLog(@"WatermelonDB JSLock perfhack failed - %@. Falling back...", whytho);
        didWarn = true;
    }
}

}

@implementation NSObject (JSValueHacks)

+ (id) watermelonSwizzledValueWithJSValueRef:(JSValueRef)ref inContext:(JSContext*)ctx {
    using namespace watermelondb;
    //  NOTE: bring this back if we can unswizzle after the hack
    //    if (didBlockExecuteUsingHack) {
    //        NSLog(@"WatermelonDB JSLock perfhack assertion failure - swizzled method called but block has already executed");
    //    }

    if (blockToExecute && !didBlockExecuteUsingHack) {
        // Call our block from within a JSLockHolding context, yay!
        auto block = *blockToExecute;
        didBlockExecuteUsingHack = true;
        block();
    }

    // Proceed with original implementation
    return [self watermelonSwizzledValueWithJSValueRef:ref inContext:ctx];
}

@end

void watermelonCallWithJSCLockHolder(jsi::Runtime& rt, std::function<void (void)> block) {
    using namespace watermelondb;
    float systemVersion = [[[UIDevice currentDevice] systemVersion] floatValue];

    if (systemVersion < 13 || systemVersion >= 16) {
        // Those iOS versions have not been tested, so using fallback
        // Please contribute :)
        perfhackFail(@"unknown iOS version");
        block();
        return;
    }

    JSGlobalContextRef globalContext = (JSGlobalContextRef) rt.getContext();

    if (!globalContext) {
        perfhackFail(@"broken JSI integration");
        block();
        return;
    }

    // Swizzling path:
    // + [JSManagedValue managedValueWithValue:]
    //   https://github.com/WebKit/webkit/blob/64dc0d1354d65e0cb3e42294429275a0d3b7209d/Source/JavaScriptCore/API/JSManagedValue.mm#L63
    // - [JSManagedValue value]
    //   https://github.com/WebKit/webkit/blob/64dc0d1354d65e0cb3e42294429275a0d3b7209d/Source/JavaScriptCore/API/JSManagedValue.mm#L147
    // + [JSValue valueWithJSValueRef:inContext:]
    //   this is the method we're swizzling to call our block of code
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Method origMethod = class_getClassMethod([JSValue class], @selector(valueWithJSValueRef:inContext:));
        Method newMethod = class_getClassMethod([NSObject class], @selector(watermelonSwizzledValueWithJSValueRef:inContext:));

        if (!origMethod || !newMethod) {
            perfhackFail(@"missing methods to swizzle");
            return;
        }

        // Note: it would seem slightly safer to swizzle before dummy call and then unswizzle - in case someone else
        // also wants to do this swizzle. But for many small calls, this triggers so many objc cache flushes, it overwhelms
        // the performance win completely
        method_exchangeImplementations(origMethod, newMethod);
    });

    JSContext *context = [JSContext contextWithJSGlobalContextRef:globalContext];
    JSManagedValue *dummyValue = [JSManagedValue managedValueWithValue:[JSValue valueWithUndefinedInContext:context]];

    // trigger the swizzled version
    blockToExecute = &block;
    didBlockExecuteUsingHack = false;
    // NOTE: https://sentry.nozbe.tv/organizations/sentry/issues/139/?project=2&query=is%3Aunresolved
    // There's a single instance of a crash here. Could be a fluke?
    [dummyValue value];

    if (!didBlockExecuteUsingHack) {
        perfhackFail(@"swizzled method did not call our block");
        blockToExecute = nullptr;
        block();
    }
}

#else

// Used as fallback if hack is not compiled
void watermelonCallWithJSCLockHolder(jsi::Runtime& rt, std::function<void (void)> block) {
    block();
}

#endif
