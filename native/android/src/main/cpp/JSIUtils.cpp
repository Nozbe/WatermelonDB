#pragma once

#include "JSIUtils.h"

jsi::Array convertWritableArrayToJSIArray(jsi::Runtime &runtime, JNIEnv *env, jobject writableArray) {
    // Get the class of the WritableArray
    jclass writableArrayClass = env->GetObjectClass(writableArray);

    // Get the method ID for `toArrayList()`
    jmethodID toArrayListMethod = env->GetMethodID(writableArrayClass, "toArrayList", "()Ljava/util/ArrayList;");
    if (toArrayListMethod == nullptr) {
        throw std::runtime_error("Could not find toArrayList method in WritableArray");
    }

    // Call toArrayList() to get an ArrayList<Object>
    jobject arrayList = env->CallObjectMethod(writableArray, toArrayListMethod);
    if (arrayList == nullptr) {
        throw std::runtime_error("Failed to retrieve ArrayList from WritableArray");
    }

    // Get the class of ArrayList
    jclass arrayListClass = env->GetObjectClass(arrayList);

    // Get the method ID for `size()` on ArrayList
    jmethodID arrayListSizeMethod = env->GetMethodID(arrayListClass, "size", "()I");
    jint size = env->CallIntMethod(arrayList, arrayListSizeMethod);

    // Create a JSI Array to hold the results
    jsi::Array jsiArray(runtime, size);

    // Get the method ID for `get(int index)` on ArrayList
    jmethodID arrayListGetMethod = env->GetMethodID(arrayListClass, "get", "(I)Ljava/lang/Object;");

    // Iterate through the elements in the ArrayList
    for (jsize i = 0; i < size; i++) {
        // Retrieve the object at index i
        jobject item = env->CallObjectMethod(arrayList, arrayListGetMethod, i);

        // Check if the item is null
        if (item == nullptr) {
            jsiArray.setValueAtIndex(runtime, i, jsi::Value::null());
            continue;
        }

        // Get the class of the item
        jclass itemClass = env->GetObjectClass(item);

        // Check for string type
        jclass stringClass = env->FindClass("java/lang/String");
        if (env->IsInstanceOf(item, stringClass)) {
            jstring jstr = static_cast<jstring>(item);
            const char* cstr = env->GetStringUTFChars(jstr, nullptr);
            jsiArray.setValueAtIndex(runtime, i, jsi::String::createFromUtf8(runtime, cstr));
            env->ReleaseStringUTFChars(jstr, cstr);
        }
            // Check for Integer type
        else if (env->IsInstanceOf(item, env->FindClass("java/lang/Integer"))) {
            jclass integerClass = env->FindClass("java/lang/Integer");
            jmethodID intValueMethod = env->GetMethodID(integerClass, "intValue", "()I");
            jint intValue = env->CallIntMethod(item, intValueMethod);
            jsiArray.setValueAtIndex(runtime, i, jsi::Value(static_cast<double>(intValue)));
        }
            // Check for Double type
        else if (env->IsInstanceOf(item, env->FindClass("java/lang/Double"))) {
            jclass doubleClass = env->FindClass("java/lang/Double");
            jmethodID doubleValueMethod = env->GetMethodID(doubleClass, "doubleValue", "()D");
            jdouble doubleValue = env->CallDoubleMethod(item, doubleValueMethod);
            jsiArray.setValueAtIndex(runtime, i, jsi::Value(static_cast<double>(doubleValue)));
        }
            // Check for Boolean type
        else if (env->IsInstanceOf(item, env->FindClass("java/lang/Boolean"))) {
            jclass booleanClass = env->FindClass("java/lang/Boolean");
            jmethodID booleanValueMethod = env->GetMethodID(booleanClass, "booleanValue", "()Z");
            jboolean boolValue = env->CallBooleanMethod(item, booleanValueMethod);
            jsiArray.setValueAtIndex(runtime, i, jsi::Value(static_cast<bool>(boolValue)));
        }
            // Check for another WritableArray (nested array)
        else if (env->IsInstanceOf(item, env->FindClass("com/facebook/react/bridge/WritableArray"))) {
            jsiArray.setValueAtIndex(runtime, i, convertWritableArrayToJSIArray(runtime, env, item));
        }
        else if (env->IsInstanceOf(item, env->FindClass("com/facebook/react/bridge/WritableMap"))) {
            // writable maps are also readable maps
            jsiArray.setValueAtIndex(runtime, i, convertReadableMapToJSIValue(runtime, env, item));
        }
        else if (env->IsInstanceOf(item, env->FindClass("com/facebook/react/bridge/WritableMap"))) {
            jsiArray.setValueAtIndex(runtime, i, convertReadableMapToJSIValue(runtime, env, item));
        }
        else if (env->IsInstanceOf(item, env->FindClass("java/util/HashMap"))) {
            jsiArray.setValueAtIndex(runtime, i, convertHashMapToJSIObject(runtime, env, item));
        }
        else {
            jclass itemClass = env->GetObjectClass(item);

            // Get the class's getName method
            jclass classClass = env->FindClass("java/lang/Class");
            jmethodID getNameMethod = env->GetMethodID(classClass, "getName", "()Ljava/lang/String;");

            // Call getName on the class
            jstring classNameString = (jstring) env->CallObjectMethod(itemClass, getNameMethod);

            // Convert the jstring to a C-string
            const char* classNameCStr = env->GetStringUTFChars(classNameString, nullptr);

            // Print the class name
            printf("Unsupported data type in WritableArray: %s\n", classNameCStr);

            // Release the C-string memory
            env->ReleaseStringUTFChars(classNameString, classNameCStr);

            throw std::runtime_error("Unsupported data type in WritableArray");
        }

        // Cleanup local references
        env->DeleteLocalRef(item);
        env->DeleteLocalRef(itemClass);
    }

    // Cleanup
    env->DeleteLocalRef(arrayList);
    env->DeleteLocalRef(arrayListClass);

    return jsiArray;  // Return the populated JSI array
}

jsi::Value convertReadableMapToJSIValue(jsi::Runtime &runtime, JNIEnv *env, jobject readableMap) {
    jsi::Object jsiObject(runtime);

    jclass readableMapClass = env->GetObjectClass(readableMap);
    jmethodID keySetMethod = env->GetMethodID(readableMapClass, "keySet", "()Ljava/util/Set;");
    jmethodID getMethod = env->GetMethodID(readableMapClass, "get", "(Ljava/lang/String;)Ljava/lang/Object;");

    jobject keySet = env->CallObjectMethod(readableMap, keySetMethod);
    jclass setClass = env->GetObjectClass(keySet);
    jmethodID toArrayMethod = env->GetMethodID(setClass, "toArray", "()[Ljava/lang/Object;");

    jobjectArray keysArray = static_cast<jobjectArray>(env->CallObjectMethod(keySet, toArrayMethod));
    jsize keyCount = env->GetArrayLength(keysArray);

    for (jsize i = 0; i < keyCount; i++) {
        jstring key = static_cast<jstring>(env->GetObjectArrayElement(keysArray, i));
        const char *keyStr = env->GetStringUTFChars(key, nullptr);

        jobject value = env->CallObjectMethod(readableMap, getMethod, key);
        jsi::Value jsiValue = convertReadableMapToJSIValue(runtime, env, value);  // Another helper function

        jsiObject.setProperty(runtime, keyStr, jsiValue);

        env->ReleaseStringUTFChars(key, keyStr);
        env->DeleteLocalRef(key);
        env->DeleteLocalRef(value);
    }

    env->DeleteLocalRef(keysArray);
    env->DeleteLocalRef(keySet);

    return jsiObject;
}

jobject convertJSIArrayToReadableArray(jsi::Runtime &runtime, JNIEnv *env, const jsi::Array &jsiArray) {
    // Get the class and constructor for WritableNativeArray
    jclass writableArrayClass = env->FindClass("com/facebook/react/bridge/WritableNativeArray");
    jmethodID writableArrayConstructor = env->GetMethodID(writableArrayClass, "<init>", "()V");

    // Create a new WritableNativeArray
    jobject writableArray = env->NewObject(writableArrayClass, writableArrayConstructor);

    // Get method IDs for adding various data types to WritableNativeArray
    jmethodID putIntMethod = env->GetMethodID(writableArrayClass, "pushInt", "(I)V");
    jmethodID putDoubleMethod = env->GetMethodID(writableArrayClass, "pushDouble", "(D)V");
    jmethodID putBooleanMethod = env->GetMethodID(writableArrayClass, "pushBoolean", "(Z)V");
    jmethodID putStringMethod = env->GetMethodID(writableArrayClass, "pushString", "(Ljava/lang/String;)V");
    jmethodID putArrayMethod = env->GetMethodID(writableArrayClass, "pushArray", "(Lcom/facebook/react/bridge/ReadableArray;)V");
    jmethodID putMapMethod = env->GetMethodID(writableArrayClass, "pushMap", "(Lcom/facebook/react/bridge/ReadableMap;)V");
    jmethodID pushNullMethod = env->GetMethodID(writableArrayClass, "pushNull", "()V");

    // Iterate through the JSI Array elements
    size_t length = jsiArray.size(runtime);
    for (size_t i = 0; i < length; i++) {
        jsi::Value value = jsiArray.getValueAtIndex(runtime, i);

        if (value.isNumber()) {
            jdouble doubleValue = value.asNumber();
            env->CallVoidMethod(writableArray, putDoubleMethod, doubleValue);
        }
            // Handle boolean types
        else if (value.isBool()) {
            jboolean boolValue = value.asBool();
            env->CallVoidMethod(writableArray, putBooleanMethod, boolValue);
        }
            // Handle string types
        else if (value.isString()) {
            std::string str = value.asString(runtime).utf8(runtime);
            jstring javaString = env->NewStringUTF(str.c_str());
            env->CallVoidMethod(writableArray, putStringMethod, javaString);
            env->DeleteLocalRef(javaString);
        }
            // Handle objects: check if the object is an array or map (ReadableArray or ReadableMap)
        else if (value.isObject()) {
            jsi::Object obj = value.asObject(runtime);

            // Handle nested arrays
            if (obj.isArray(runtime)) {
                jsi::Array nestedArray = obj.asArray(runtime);
                jobject nestedReadableArray = convertJSIArrayToReadableArray(runtime, env, nestedArray);
                env->CallVoidMethod(writableArray, putArrayMethod, nestedReadableArray);
                env->DeleteLocalRef(nestedReadableArray);
            }
                // Handle maps (objects)
            else {
                // TODO Add if needed
//                jobject readableMap = convertJSIObjectToReadableMap(runtime, env, obj);
//                env->CallVoidMethod(writableArray, putMapMethod, readableMap);
//                env->DeleteLocalRef(readableMap);
            }
        }
            // Handle null values
        else if (value.isNull() || value.isUndefined()) {
            env->CallVoidMethod(writableArray, pushNullMethod);
        }
    }

    return writableArray;  // Return the filled WritableNativeArray
}

jsi::Object convertHashMapToJSIObject(jsi::Runtime& runtime, JNIEnv* env, jobject hashMap) {
    // Find the entrySet() method of HashMap
    jclass hashMapClass = env->FindClass("java/util/HashMap");
    jmethodID entrySetMethod = env->GetMethodID(hashMapClass, "entrySet", "()Ljava/util/Set;");
    jobject entrySet = env->CallObjectMethod(hashMap, entrySetMethod);

    // Get the iterator from the entry set
    jclass setClass = env->FindClass("java/util/Set");
    jmethodID iteratorMethod = env->GetMethodID(setClass, "iterator", "()Ljava/util/Iterator;");
    jobject iterator = env->CallObjectMethod(entrySet, iteratorMethod);

    jclass iteratorClass = env->FindClass("java/util/Iterator");
    jmethodID hasNextMethod = env->GetMethodID(iteratorClass, "hasNext", "()Z");
    jmethodID nextMethod = env->GetMethodID(iteratorClass, "next", "()Ljava/lang/Object;");

    // Create a JSI object to store the key-value pairs
    jsi::Object jsiObject(runtime);

    // Iterate over the HashMap entries
    while (env->CallBooleanMethod(iterator, hasNextMethod)) {
        jobject entry = env->CallObjectMethod(iterator, nextMethod);

        // Get the key and value from the entry
        jclass entryClass = env->FindClass("java/util/Map$Entry");
        jmethodID getKeyMethod = env->GetMethodID(entryClass, "getKey", "()Ljava/lang/Object;");
        jmethodID getValueMethod = env->GetMethodID(entryClass, "getValue", "()Ljava/lang/Object;");

        jobject key = env->CallObjectMethod(entry, getKeyMethod);
        jobject value = env->CallObjectMethod(entry, getValueMethod);

        // Convert the key and value to JSI values (you'll need to implement this conversion)
        jsi::String jsiKey = convertJObjectToJSIString(runtime, env, key);
        jsi::Value jsiValue = convertJObjectToJSIValue(runtime, env, value);

        // Set the key-value pair in the JSI object
        jsiObject.setProperty(runtime, jsiKey, jsiValue);
    }

    return jsiObject;
}

jsi::String convertJObjectToJSIString(jsi::Runtime& runtime, JNIEnv* env, jobject obj) {
    // Check if the object is a string
    if (env->IsInstanceOf(obj, env->FindClass("java/lang/String"))) {
        jstring jStr = (jstring)obj;  // Cast the jobject to jstring
        const char* cStr = env->GetStringUTFChars(jStr, nullptr);

        // Create a JSI string from the UTF-8 string
        jsi::String jsiStr = jsi::String::createFromUtf8(runtime, cStr);

        // Release the UTF string after use
        env->ReleaseStringUTFChars(jStr, cStr);

        return jsiStr;
    } else {
        throw std::runtime_error("Expected a java/lang/String object.");
    }
}

jsi::Value convertJObjectToJSIValue(jsi::Runtime& runtime, JNIEnv* env, jobject obj) {
    if (obj == nullptr) {
        // Return null if the jobject is null
        return jsi::Value::null();
    }

    // Handle String
    if (env->IsInstanceOf(obj, env->FindClass("java/lang/String"))) {
        return jsi::Value(convertJObjectToJSIString(runtime, env, obj));
    }
        // Handle Integer
    else if (env->IsInstanceOf(obj, env->FindClass("java/lang/Integer"))) {
        jclass integerClass = env->FindClass("java/lang/Integer");
        jmethodID intValueMethod = env->GetMethodID(integerClass, "intValue", "()I");
        jint intValue = env->CallIntMethod(obj, intValueMethod);
        return jsi::Value(static_cast<double>(intValue));  // JSI only supports double for numbers
    }
        // Handle Double
    else if (env->IsInstanceOf(obj, env->FindClass("java/lang/Double"))) {
        jclass doubleClass = env->FindClass("java/lang/Double");
        jmethodID doubleValueMethod = env->GetMethodID(doubleClass, "doubleValue", "()D");
        jdouble doubleValue = env->CallDoubleMethod(obj, doubleValueMethod);
        return jsi::Value(static_cast<double>(doubleValue));
    }
        // Handle Boolean
    else if (env->IsInstanceOf(obj, env->FindClass("java/lang/Boolean"))) {
        jclass booleanClass = env->FindClass("java/lang/Boolean");
        jmethodID booleanValueMethod = env->GetMethodID(booleanClass, "booleanValue", "()Z");
        jboolean boolValue = env->CallBooleanMethod(obj, booleanValueMethod);
        return jsi::Value(static_cast<bool>(boolValue));
    }
        // Handle HashMap (ReadableMap/WritableMap)
    else if (env->IsInstanceOf(obj, env->FindClass("java/util/HashMap"))) {
        return jsi::Value(convertHashMapToJSIObject(runtime, env, obj));
    }
        // Handle arrays (ReadableArray/WritableArray)
    else if (env->IsInstanceOf(obj, env->FindClass("java/util/ArrayList"))) {
        return jsi::Value(convertArrayListToJSIArray(runtime, env, obj));
    }
        // If unsupported type
    else {
        throw std::runtime_error("Unsupported jobject type for conversion to JSI value.");
    }
}

jsi::Array convertArrayListToJSIArray(jsi::Runtime& runtime, JNIEnv* env, jobject arrayList) {
    // Get the ArrayList class and methods
    jclass arrayListClass = env->FindClass("java/util/ArrayList");
    jmethodID sizeMethod = env->GetMethodID(arrayListClass, "size", "()I");
    jmethodID getMethod = env->GetMethodID(arrayListClass, "get", "(I)Ljava/lang/Object;");

    // Get the size of the ArrayList
    jint size = env->CallIntMethod(arrayList, sizeMethod);

    // Create a JSI Array of the same size
    jsi::Array jsiArray(runtime, size);

    // Loop over the ArrayList and convert each item to a JSI Value
    for (jsize i = 0; i < size; i++) {
        // Get the item from the ArrayList
        jobject item = env->CallObjectMethod(arrayList, getMethod, i);

        // Convert the item to a JSI Value using the conversion function
        jsi::Value jsiValue = convertJObjectToJSIValue(runtime, env, item);

        // Set the value in the JSI Array
        jsiArray.setValueAtIndex(runtime, i, jsiValue);
    }

    return jsiArray;
}