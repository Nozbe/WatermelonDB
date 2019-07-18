#import <jsi/JSIDynamic.h>
#import <React/RCTBridge+Private.h>

#import "MelonModuleJSI.h"
#import "JSIUtilities.h"

struct EventHandlerWrapper {
    EventHandlerWrapper(jsi::Function eventHandler)
    : callback(std::move(eventHandler)) {}

    jsi::Function callback;
};

void MelonModuleJSI::install(MelonModule* testModule) {
    RCTCxxBridge *cxxBridge = testModule.bridge;
    if (cxxBridge.runtime == nullptr) {
        return;
    }

    jsi::Runtime &runtime = *(jsi::Runtime *)cxxBridge.runtime;

    auto testBinding = std::make_shared<MelonModuleJSI>(std::move(testModule));

    auto moduleName = "melonModule";
    auto object = jsi::Object::createFromHostObject(runtime, testBinding);
    runtime.global().setProperty(runtime, moduleName, std::move(object));
}

MelonModuleJSI::MelonModuleJSI(MelonModule* melonModule)
: melonModule_(melonModule) {}

jsi::Value MelonModuleJSI::get(
                            jsi::Runtime &runtime,
                            const jsi::PropNameID &name) {
    auto methodName = name.utf8(runtime);
    MelonModule* testModule = melonModule_;

    if (methodName == "getInt") {
        return jsi::Function::createFromHostFunction(runtime, name, 0, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            return [testModule getInt];
        });
    } else if (methodName == "getDouble") {
        return jsi::Function::createFromHostFunction(runtime, name, 0, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            return [testModule getDouble];
        });
    } else if (methodName == "multiply") {
        return jsi::Function::createFromHostFunction(runtime, name, 2, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            auto arg1 = &arguments[0];
            auto arg2 = &arguments[1];

            return [testModule getMul:arg1->asNumber() b:arg2->asNumber()];
        });
    } else if (methodName == "nativeLog") {
        return jsi::Function::createFromHostFunction(runtime, name, 1, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            auto arg1 = &arguments[0];
            NSString *text = convertJSIStringToNSString(runtime, arg1->getString(runtime));

            [testModule nativeLog:text];
            return jsi::Value::undefined();
        });
    } else if (methodName == "initialize") {
        return jsi::Function::createFromHostFunction(runtime, name, 5, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            auto arg1 = &arguments[0];
            auto arg2 = &arguments[1];
            auto arg3 = &arguments[2];
            auto arg4 = &arguments[3];
            auto arg5 = &arguments[4];

            NSNumber *tag = [NSNumber numberWithDouble:arg1->asNumber()];
            NSString *name = convertJSIStringToNSString(runtime, arg2->getString(runtime));
            NSNumber *version = [NSNumber numberWithDouble:arg3->asNumber()];

            jsi::Function resolve = arg4->getObject(runtime).asFunction(runtime);
            auto resolveHandler = std::make_shared<EventHandlerWrapper>(std::move(resolve));

            RCTPromiseResolveBlock resolveBlock = ^(NSDictionary* result) {
                auto &resolveWrapper = static_cast<const EventHandlerWrapper &>(*resolveHandler);

                auto resultJsi = convertNSDictionaryToJSIObject(runtime, result);
                resolveWrapper.callback.call(runtime, resultJsi);
            };

            jsi::Function reject = arg5->getObject(runtime).asFunction(runtime);
            auto rejectHandler = std::make_shared<EventHandlerWrapper>(std::move(reject));

            RCTPromiseRejectBlock rejectBlock = ^(NSString *code, NSString *message, NSError *error) {
                auto &rejectWrapper = static_cast<const EventHandlerWrapper &>(*rejectHandler);

                rejectWrapper.callback.call(runtime,
                                            convertObjCObjectToJSIValue(runtime, code),
                                            convertObjCObjectToJSIValue(runtime, message));
            };

            [testModule initialize: tag
                      databaseName: name
                     schemaVersion: version
                           resolve: resolveBlock
                            reject: rejectBlock];

            return jsi::Value::undefined();
        });
    } else if (methodName == "setUpWithSchema") {
        return jsi::Function::createFromHostFunction(runtime, name, 6, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            auto arg1 = &arguments[0];
            auto arg2 = &arguments[1];
            auto arg3 = &arguments[2];
            auto arg4 = &arguments[3];
            auto arg5 = &arguments[4];
            auto arg6 = &arguments[5];
            
            NSNumber *tag = [NSNumber numberWithDouble:arg1->asNumber()];
            NSString *name = convertJSIStringToNSString(runtime, arg2->getString(runtime));
            NSString *schema = convertJSIStringToNSString(runtime, arg3->getString(runtime));
            NSNumber *schemaVersion = [NSNumber numberWithDouble:arg4->asNumber()];
            
            jsi::Function resolve = arg5->getObject(runtime).asFunction(runtime);
            auto resolveHandler = std::make_shared<EventHandlerWrapper>(std::move(resolve));
            
            RCTPromiseResolveBlock resolveBlock = ^(NSDictionary* result) {
                auto &resolveWrapper = static_cast<const EventHandlerWrapper &>(*resolveHandler);

                auto resultJsi = convertObjCObjectToJSIValue(runtime, result);
                resolveWrapper.callback.call(runtime, resultJsi);
            };

            jsi::Function reject = arg6->getObject(runtime).asFunction(runtime);
            auto rejectHandler = std::make_shared<EventHandlerWrapper>(std::move(reject));

            RCTPromiseRejectBlock rejectBlock = ^(NSString *code, NSString *message, NSError *error) {
                auto &rejectWrapper = static_cast<const EventHandlerWrapper &>(*rejectHandler);

                rejectWrapper.callback.call(runtime,
                                            convertObjCObjectToJSIValue(runtime, code),
                                            convertObjCObjectToJSIValue(runtime, message));
            };

            [testModule setUpWithSchema:tag databaseName:name schema:schema schemaVersion:schemaVersion resolve:resolveBlock reject:rejectBlock];
            
            return jsi::Value::undefined();
        });
    } else if (methodName == "setUpWithMigrations") {
        return jsi::Value::undefined();
    } else if (methodName == "find") {
        return jsi::Function::createFromHostFunction(runtime, name, 5, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            
            auto arg1 = &arguments[0];
            auto arg2 = &arguments[1];
            auto arg3 = &arguments[2];
            auto arg4 = &arguments[3];
            auto arg5 = &arguments[4];
            
            NSNumber *tag = [NSNumber numberWithDouble:arg1->asNumber()];
            NSString *table = convertJSIStringToNSString(runtime, arg2->getString(runtime));
            NSString *recordId = convertJSIStringToNSString(runtime, arg3->getString(runtime));
            
            jsi::Function resolve = arg4->getObject(runtime).asFunction(runtime);
            auto resolveHandler = std::make_shared<EventHandlerWrapper>(std::move(resolve));
            
            RCTPromiseResolveBlock resolveBlock = ^(NSDictionary* result) {
                auto &resolveWrapper = static_cast<const EventHandlerWrapper &>(*resolveHandler);

                auto resultJsi = convertObjCObjectToJSIValue(runtime, result);
                resolveWrapper.callback.call(runtime, resultJsi);
            };

            jsi::Function reject = arg5->getObject(runtime).asFunction(runtime);
            auto rejectHandler = std::make_shared<EventHandlerWrapper>(std::move(reject));

            RCTPromiseRejectBlock rejectBlock = ^(NSString *code, NSString *message, NSError *error) {
                auto &rejectWrapper = static_cast<const EventHandlerWrapper &>(*rejectHandler);

                rejectWrapper.callback.call(runtime,
                                            convertObjCObjectToJSIValue(runtime, code),
                                            convertObjCObjectToJSIValue(runtime, message));
            };
            
            [testModule find:tag table:table id:recordId resolve:resolveBlock reject:rejectBlock];
            
            return jsi::Value::undefined();
        });
    } else if (methodName == "query") {
        return jsi::Function::createFromHostFunction(runtime, name, 5, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            auto arg1 = &arguments[0];
            auto arg2 = &arguments[1];
            auto arg3 = &arguments[2];
            auto arg4 = &arguments[3];
            auto arg5 = &arguments[4];
            
            NSNumber *tag = [NSNumber numberWithDouble:arg1->asNumber()];
            NSString *table= convertJSIStringToNSString(runtime, arg2->getString(runtime));
            NSString *query = convertJSIStringToNSString(runtime, arg3->getString(runtime));
            
            jsi::Function resolve = arg4->getObject(runtime).asFunction(runtime);
            auto resolveHandler = std::make_shared<EventHandlerWrapper>(std::move(resolve));
            
            RCTPromiseResolveBlock resolveBlock = ^(NSDictionary* result) {
                auto &resolveWrapper = static_cast<const EventHandlerWrapper &>(*resolveHandler);

                NSDate *before = [NSDate date];
                auto resultJsi = convertObjCObjectToJSIValue(runtime, result);
                NSDate *after = [NSDate date];
                NSLog(@"query callback conversion: %f", [after timeIntervalSinceDate:before] * 1000.0);
                resolveWrapper.callback.call(runtime, resultJsi);
            };

            jsi::Function reject = arg5->getObject(runtime).asFunction(runtime);
            auto rejectHandler = std::make_shared<EventHandlerWrapper>(std::move(reject));

            RCTPromiseRejectBlock rejectBlock = ^(NSString *code, NSString *message, NSError *error) {
                auto &rejectWrapper = static_cast<const EventHandlerWrapper &>(*rejectHandler);

                rejectWrapper.callback.call(runtime,
                                            convertObjCObjectToJSIValue(runtime, code),
                                            convertObjCObjectToJSIValue(runtime, message));
            };
            
            [testModule query:tag table:table query:query resolve:resolveBlock reject:rejectBlock];
            
            return jsi::Value::undefined();
        });
    } else if (methodName == "count") {
        return jsi::Value::undefined();
    } else if (methodName == "batch") {
        return jsi::Function::createFromHostFunction(runtime, name, 4, [testModule](
                                                                                    jsi::Runtime &runtime,
                                                                                    const jsi::Value &thisValue,
                                                                                    const jsi::Value *arguments,
                                                                                    size_t count) -> jsi::Value {
            auto arg1 = &arguments[0];
            auto arg2 = &arguments[1];
            auto arg3 = &arguments[2];
            auto arg4 = &arguments[3];

            NSDate *before = [NSDate date];
            NSNumber *tag = [NSNumber numberWithDouble:arg1->asNumber()];
            NSArray *operations = convertJSIBatchOperationsObjToObjCObject(runtime, arg2->asObject(runtime));
            NSDate *after = [NSDate date];
            NSLog(@"batch conversion: %f", [after timeIntervalSinceDate:before] * 1000.0);
            
            jsi::Function resolve = arg3->getObject(runtime).asFunction(runtime);
            auto resolveHandler = std::make_shared<EventHandlerWrapper>(std::move(resolve));
            
            RCTPromiseResolveBlock resolveBlock = ^(NSDictionary* result) {
                auto &resolveWrapper = static_cast<const EventHandlerWrapper &>(*resolveHandler);

                auto resultJsi = convertObjCObjectToJSIValue(runtime, result);
                resolveWrapper.callback.call(runtime, resultJsi);
            };

            jsi::Function reject = arg4->getObject(runtime).asFunction(runtime);
            auto rejectHandler = std::make_shared<EventHandlerWrapper>(std::move(reject));

            RCTPromiseRejectBlock rejectBlock = ^(NSString *code, NSString *message, NSError *error) {
                auto &rejectWrapper = static_cast<const EventHandlerWrapper &>(*rejectHandler);

                rejectWrapper.callback.call(runtime,
                                            convertObjCObjectToJSIValue(runtime, code),
                                            convertObjCObjectToJSIValue(runtime, message));
            };
            
            [testModule batch:tag operations:operations resolve:resolveBlock reject:rejectBlock];
            
            return jsi::Value::undefined();
        });
    } else if (methodName == "getDeletedRecords") {
        return jsi::Value::undefined();
    } else if (methodName == "destroyDeletedRecords") {
        return jsi::Value::undefined();
    } else if (methodName == "unsafeResetDatabase") {
        return jsi::Value::undefined();
    } else if (methodName == "getLocal") {
        return jsi::Value::undefined();
    } else if (methodName == "setLocal") {
        return jsi::Value::undefined();
    } else if (methodName == "removeLocal") {
        return jsi::Value::undefined();
    } else {
        return jsi::Value::undefined();
    }
}
