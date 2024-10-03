//
// Created by BuildOpsLA27 on 9/30/24.
//

#ifndef BUILDOPSMOBILE_JSIANDROIDBRIDGEWRAPPER_H
#define BUILDOPSMOBILE_JSIANDROIDBRIDGEWRAPPER_H

#include <jni.h>
#include <jsi/jsi.h>

using namespace facebook;

namespace watermelondb {
    void configureJNI(JNIEnv *env);

    class JSIAndroidBridge : public jsi::HostObject {
    public:
        static void install(jsi::Runtime *runtime, jobject bridge);

        JSIAndroidBridge(jsi::Runtime *runtime, jobject bridge);
        ~JSIAndroidBridge();

        jsi::Value query(const jsi::Value &tag, const jsi::String &table, const jsi::String &query);
        jsi::Value execSqlQuery(const jsi::Value &tag, const jsi::String &sql, const jsi::Array &arguments);

    private:
        jobject bridge_;

        jsi::Runtime *runtime_;
    };
}

#endif //BUILDOPSMOBILE_JSIANDROIDBRIDGEWRAPPER_H
