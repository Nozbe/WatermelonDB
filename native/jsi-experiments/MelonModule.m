#import <React/RCTBridgeModule.h>
#import "MelonModule.h"
#import "nozbe4-Swift.h"
#import "MelonModuleJSIInstaller.h"

@implementation MelonModule
{
    __weak RCTCxxBridge *_bridge;
    MelonModuleImpl *_impl;
}

RCT_EXPORT_MODULE();

- (instancetype)init
{
    self = [super init];
    if (self) {
        _impl = [MelonModuleImpl new];
    }
    return self;
}

- (RCTCxxBridge *) bridge {
    return _bridge;
}

- (void)setBridge:(RCTBridge *)bridge
{
    _bridge = (RCTCxxBridge *)bridge;

}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(id, initializeJSI) {
    installMelonModuleJSI(self);
    return self;
}

- (id)forwardingTargetForSelector:(SEL)aSelector {
    return _impl;
}

@end
