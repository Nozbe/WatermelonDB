#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(BridgeTestReporter, BridgeTestReporter, NSObject)

RCT_EXTERN_METHOD(testsFinished:(NSDictionary*)report)

@end
