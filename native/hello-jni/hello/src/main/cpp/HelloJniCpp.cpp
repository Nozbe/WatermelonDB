//
// Created by Radosław Pietruszewski on 2019-09-19.
//

#include <jsi/jsi.h>
//#include <jsi/JSIDynamic.h>
#include <jni.h>

#include "HelloJniCpp.h"

using namespace facebook;

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_hellojni_HelloJni_stringFromJNICpp(JNIEnv* env, jobject thiz) {
    return env->NewStringUTF("Hello from JeeEnnAyee C++");
}

extern "C" JNIEXPORT void JNICALL
Java_com_example_hellojni_HelloJni_installBinding(JNIEnv* env, jobject thiz, jlong runtimePtr) {
    jsi::Runtime &runtime = *(jsi::Runtime *) runtimePtr;

    jsi::String proofString = jsi::String::createFromAscii(runtime, "Hello");

    runtime.global().setProperty(runtime, "wmelonJsiProof", std::move(proofString));
}




// example from https://github.com/ericlewis/react-native-hostobject-demo

class Test {
private:
    friend class TestBinding;

    int runTest() const;
};

int Test::runTest() const {
    return 1337;
}

class TestBinding : public jsi::HostObject {
public:
    /*
      * Installs TestBinding into JavaSctipt runtime.
      * Thread synchronization must be enforced externally.
      */
    static void install(
            jsi::Runtime &runtime,
            std::shared_ptr<TestBinding> testBinding);

    TestBinding(std::unique_ptr<Test> test);

    /*
      * `jsi::HostObject` specific overloads.
      */
    jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &name) override;

private:
    std::unique_ptr<Test> test_;
};

//static jsi::Object getModule(
//        jsi::Runtime &runtime,
//        const std::string &moduleName) {
//    auto batchedBridge =
//            runtime.global().getPropertyAsObject(runtime, "__fbBatchedBridge");
//    auto getCallableModule =
//            batchedBridge.getPropertyAsFunction(runtime, "getCallableModule");
//    auto module = getCallableModule
//            .callWithThis(
//                    runtime,
//                    batchedBridge,
//                    {jsi::String::createFromUtf8(runtime, moduleName)})
//            .asObject(runtime);
//    return module;
//}

void TestBinding::install(
        jsi::Runtime &runtime,
        std::shared_ptr<TestBinding> testBinding) {
    auto testModuleName = "nativeTest";
    auto object = jsi::Object::createFromHostObject(runtime, testBinding);
    runtime.global().setProperty(runtime, testModuleName, std::move(object));
}

TestBinding::TestBinding(std::unique_ptr<Test> test)
        : test_(std::move(test)) {}

jsi::Value TestBinding::get(
        jsi::Runtime &runtime,
        const jsi::PropNameID &name) {
    auto methodName = name.utf8(runtime);
    auto &test = *test_;

    if (methodName == "runTest") {
        return jsi::Function::createFromHostFunction(runtime, name, 0, [&test](
                jsi::Runtime &runtime,
                const jsi::Value &thisValue,
                const jsi::Value *arguments,
                size_t count) -> jsi::Value {
            return test.runTest();
        });
    }

    return jsi::Value::undefined();
}