#import <React/RCTBridgeModule.h>

//@interface RCT_EXTERN_MODULE(BridgeTestReporter, NSObject)
// TODO: Bring back the above when React Native fixes support for Swift 5 runtime

@interface BridgeTestReporter : NSObject
@end
@interface BridgeTestReporter (RCTExternModule) <RCTBridgeModule>
@end

@implementation BridgeTestReporter (RCTExternModule)

RCT_EXTERN void RCTRegisterModule(Class);

+ (NSString *)moduleName { return @"BridgeTestReporter"; }
__attribute__((constructor)) static void initialize_BridgeTestReporter() {
    RCTRegisterModule([BridgeTestReporter class]);
}

RCT_EXTERN_METHOD(testsFinished:(NSDictionary*)report)

@end
