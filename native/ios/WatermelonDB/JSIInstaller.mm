#import "JSIInstaller.h"
#import "Database.h"

extern "C" void installWatermelonJSI(RCTCxxBridge *bridge) {
    if (bridge.runtime == nullptr) {
        return;
    }

    jsi::Runtime *runtime = (jsi::Runtime*) bridge.runtime;
    assert(runtime != nullptr);
    watermelondb::Database::install(runtime);
}

NSMutableDictionary<NSNumber*, NSData *> *providedJsons = [NSMutableDictionary new];

extern "C" void provideJson(int tag, NSData *json) {
    // TODO: ensure tag isn't used yet
    providedJsons[@(tag)] = json;
}

std::string_view consumeJson(int tag) {
    NSData *json = providedJsons[@(tag)];
//    [providedJsons removeObjectForKey:@(tag)];
    // TODO: mm
    char *jsonBytes = (char *) json.bytes;
    size_t jsonLength = json.length;
    std::string_view view(jsonBytes, jsonLength);
    return view;
}
