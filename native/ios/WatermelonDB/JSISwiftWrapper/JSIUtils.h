//
//  JSIUtils.h
//  WatermelonDB
//
//  Created by BuildOpsLA27 on 9/27/24.
//

#ifndef JSIUtils_h
#define JSIUtils_h

#import <jsi/jsi.h>


using namespace facebook;
/**
 * All static helper functions are ObjC++ specific.
 */
jsi::Value convertNSNumberToJSIBoolean(jsi::Runtime &runtime, NSNumber *value);
jsi::Value convertNSNumberToJSINumber(jsi::Runtime &runtime, NSNumber *value);
jsi::String convertNSStringToJSIString(jsi::Runtime &runtime, NSString *value);
jsi::Value convertObjCObjectToJSIValue(jsi::Runtime &runtime, id value);;
jsi::Object convertNSDictionaryToJSIObject(jsi::Runtime &runtime, NSDictionary *value);
jsi::Array convertNSArrayToJSIArray(jsi::Runtime &runtime, NSArray *value);
std::vector<jsi::Value> convertNSArrayToStdVector(jsi::Runtime &runtime, NSArray *value);
jsi::Value convertObjCObjectToJSIValue(jsi::Runtime &runtime, id value);
id convertJSIValueToObjCObject(
    jsi::Runtime &runtime,
    const jsi::Value &value);
NSString* convertJSIStringToNSString(jsi::Runtime &runtime, const jsi::String &value);
NSArray* convertJSIArrayToNSArray(
    jsi::Runtime &runtime,
                                         const jsi::Array &value);
NSDictionary *convertJSIObjectToNSDictionary(
    jsi::Runtime &runtime,
    const jsi::Object &value);

id convertJSIValueToObjCObject(
    jsi::Runtime &runtime,
    const jsi::Value &value);

#endif /* JSIUtils_h */
