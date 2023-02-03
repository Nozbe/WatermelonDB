#include "JSLockPerfHack.h"

namespace watermelondb {

jsi::Value makeError(facebook::jsi::Runtime &rt, const std::string &desc) {
    return rt.global().getPropertyAsFunction(rt, "Error").call(rt, desc);
}

jsi::Value runBlock(facebook::jsi::Runtime &rt, std::function<jsi::Value(void)> block) {
    jsi::Value retValue;
    watermelonCallWithJSCLockHolder(rt, [&]() {
        // NOTE: C++ Exceptions don't work correctly on Android -- most likely due to the fact that
        // we don't share the C++ stdlib with React Native targets, which means that the executor
        // doesn't know how to catch our exceptions to turn them into JS errors. As a workaround,
        // we catch those ourselves and return JS Errors instead of throwing them in JS VM.
        // See also:
        // https://github.com/facebook/hermes/issues/422 - REA also catches all exceptions in C++
        //    but then passes them to Java world via JNI
        // https://github.com/facebook/hermes/issues/298#issuecomment-661352050
        // https://github.com/facebook/react-native/issues/29558
        #ifdef ANDROID
        try {
            retValue = block();
        } catch (const jsi::JSError &error) {
            retValue = makeError(rt, error.getMessage());
        } catch (const std::exception &ex) {
            std::string exceptionString("Exception in HostFunction: ");
            exceptionString += ex.what();
            retValue = makeError(rt, exceptionString);
        } catch (...) {
            std::string exceptionString("Exception in HostFunction: <unknown>");
            retValue = makeError(rt, exceptionString);
        }
        #else
        retValue = block();
        #endif
    });
    return retValue;
}

using jsiFunction = std::function<jsi::Value(jsi::Runtime &rt, const jsi::Value *args)>;

void createMethod(jsi::Runtime &runtime, jsi::Object &object, const char *methodName, unsigned int argCount, jsiFunction func) {
    jsi::PropNameID name = jsi::PropNameID::forAscii(runtime, methodName);
    jsi::Function function = jsi::Function::createFromHostFunction(runtime, name, argCount, [methodName, argCount, func]
                                                                   (jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
        if (count != argCount) {
            std::string error = std::string(methodName) + " takes " + std::to_string(argCount) + " arguments";
            #ifdef ANDROID
            consoleError(error);
            std::abort();
            #else
            throw std::invalid_argument(error);
            #endif
        }
        return runBlock(rt, [&]() {
            return func(rt, args);
        });
    });
    object.setProperty(runtime, name, function);
}

}
