#import "Trampoline.h"
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
// disable itself with every major iOS release to avoid breakage - must be manually reenabled.
//
// Swizzling path:
// + [JSManagedValue managedValueWithValue:]
//   https://github.com/WebKit/webkit/blob/64dc0d1354d65e0cb3e42294429275a0d3b7209d/Source/JavaScriptCore/API/JSManagedValue.mm#L63
// - [JSManagedValue value]
//   https://github.com/WebKit/webkit/blob/64dc0d1354d65e0cb3e42294429275a0d3b7209d/Source/JavaScriptCore/API/JSManagedValue.mm#L147
// + [JSValue valueWithJSValueRef:inContext:]
//   this is the method we're swizzling to call our block of code

jsi::Runtime *_rtTemporary;
watermelondb::Database *_dbTemporary;
jsi::Array *_operationsTemporary;

@implementation NSObject (JSValueHacks)

+ (void) hack_valueWithJSValueRef:(JSValueRef)ref inContext:(JSContext*)ctx {
    NSLog(@"hey!");
    if (_dbTemporary && _rtTemporary && _operationsTemporary) {
        _dbTemporary->batch(*_rtTemporary, *_operationsTemporary);
    }
    [self hack_valueWithJSValueRef:ref inContext:ctx];
}

@end

void jumpToDatabaseBatch(watermelondb::Database *db, jsi::Runtime& rt, jsi::Array& operations) {
    _dbTemporary = db;
    _rtTemporary = &rt;
    _operationsTemporary = &operations;

    JSGlobalContextRef ctx = (JSGlobalContextRef) rt.getContext();
    JSContext *ctxObjc = [JSContext contextWithJSGlobalContextRef:ctx];

    JSManagedValue *temp = [JSManagedValue managedValueWithValue:[JSValue valueWithUndefinedInContext:ctxObjc]];

    Method origMethod = class_getClassMethod([JSValue class], @selector(valueWithJSValueRef:inContext:));
    Method newMethod = class_getClassMethod([NSObject class], @selector(hack_valueWithJSValueRef:inContext:));

    method_exchangeImplementations(origMethod, newMethod);

    [temp value];

    method_exchangeImplementations(newMethod, origMethod);
}
