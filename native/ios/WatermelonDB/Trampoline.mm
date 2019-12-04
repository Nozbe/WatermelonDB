#import "Trampoline.h"
#import <JavaScriptCore/JavaScriptCore.h>
#import <jsi/JSCRuntime.h>
#import <objc/runtime.h>
#import <objc/message.h>

using namespace facebook;

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
//    db->batch(rt, operations);
//    return;

    _dbTemporary = db;
    _rtTemporary = &rt;
    _operationsTemporary = &operations;

    JSGlobalContextRef ctx = (JSGlobalContextRef) rt.getContext();
    JSContext *ctxObjc = [JSContext contextWithJSGlobalContextRef:ctx];

//    JSStringRef array = JSStringCreateWithUTF8CString("[]");

//    JSValue *value = [JSValue valueWithJSValueRef:JSValueMakeFromJSONString(ctx, JSStringCreateWithUTF8CString("[0]")) inContext:ctxObjc];

    JSManagedValue *temp = [JSManagedValue managedValueWithValue:[JSValue valueWithUndefinedInContext:ctxObjc]];

    Method origMethod = class_getClassMethod([JSValue class], @selector(valueWithJSValueRef:inContext:));
    Method newMethod = class_getClassMethod([NSObject class], @selector(hack_valueWithJSValueRef:inContext:));

    method_exchangeImplementations(origMethod, newMethod);

//    [value toObject];
//    [JSValue valueWithObject:@[] inContext:ctxObjc];
//    JSValue *value = [JSValue valueWithJSValueRef:JSValueMakeFromJSONString(ctx, JSStringCreateWithUTF8CString("[0]")) inContext:ctxObjc];
    [temp value];


    method_exchangeImplementations(newMethod, origMethod);
}
