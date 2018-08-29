#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BridgeTestReporter, NSObject)

RCT_EXTERN_METHOD(testsFinished:(NSDictionary*)report)

@end
