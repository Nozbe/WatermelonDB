#include "DatabasePlatform.h"
#import <Foundation/Foundation.h>
#import <React/RCTBridge.h>
#include <mutex>

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    NSLog(@"%s", message.c_str());
}

void consoleError(std::string message) {
    NSLog(@"Error: %s", message.c_str());
}

void initializeSqlite() {
    // Nothing to do
}

std::string resolveDatabasePath(std::string path) {
#if TARGET_OS_MACCATALYST
    // On Mac Catalyst (unsandboxed), NSDocumentDirectory resolves to
    // ~/Documents and any access there triggers the macOS TCC prompt
    // asking the user to grant access to their Documents folder at
    // launch. Use Application Support instead — per-app, private to the
    // bundle, and never triggers TCC.
    //
    // We intentionally don't migrate from the legacy ~/Documents path:
    // probing for a legacy file would itself trigger the TCC prompt
    // we're trying to avoid.
    NSError *err = nil;
    NSURL *appSupport = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory
                                                             inDomain:NSUserDomainMask
                                                    appropriateForURL:nil
                                                               create:YES
                                                                error:&err];

    if (err) {
        NSLog(@"Error: %@", err);
        throw std::runtime_error("Failed to resolve database path - could not find Application Support URL");
    }

    NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier] ?: @"WatermelonDB";
    NSURL *dir = [appSupport URLByAppendingPathComponent:bundleId isDirectory:YES];
    [NSFileManager.defaultManager createDirectoryAtURL:dir
                           withIntermediateDirectories:YES
                                            attributes:nil
                                                 error:nil];
    NSString *dbPath = [dir URLByAppendingPathComponent:
                       [NSString stringWithFormat:@"%s.db", path.c_str()]].path;

    return std::string([dbPath cStringUsingEncoding:NSUTF8StringEncoding]);
#else
    // Default: app documents/<name>.db
    NSError *err = nil;
    NSURL *documentsUrl = [NSFileManager.defaultManager URLForDirectory:NSDocumentDirectory
                                                             inDomain:NSUserDomainMask
                                                    appropriateForURL:nil
                                                               create:false
                                                                error:&err];

    if (err) {
        NSLog(@"Error: %@", err);
        throw std::runtime_error("Failed to resolve database path - could not find documentsUrl");
    }

    NSString *dbPath = [documentsUrl URLByAppendingPathComponent:
                      [NSString stringWithFormat:@"%s.db", path.c_str()]].path;

    return std::string([dbPath cStringUsingEncoding:NSUTF8StringEncoding]);
#endif
}

void deleteDatabaseFile(std::string path, bool warnIfDoesNotExist) {
    NSString *nsPath = [NSString stringWithCString:path.c_str() encoding:NSUTF8StringEncoding];
    NSFileManager *manager = NSFileManager.defaultManager;

    if (![manager fileExistsAtPath:nsPath]) {
        if (warnIfDoesNotExist) {
            NSLog(@"Warning: Skipping deleting %@, because it does not exist", nsPath);
        } else {
            throw std::runtime_error("Could not delete database file " + path + " because it does not exist");
        }
        return;
    }

    NSError *err = nil;
    [manager removeItemAtPath:nsPath error:&err];

    if (err) {
        throw std::runtime_error("Could not delete database file - " +
                                 std::string([err.description cStringUsingEncoding:NSUTF8StringEncoding]));
    }
}

void onMemoryAlert(std::function<void(void)> callback) {
    // TODO: Unimplemented
}

NSMutableDictionary<NSNumber *, NSData *> *providedSyncJsons = [NSMutableDictionary new];
std::mutex providedSyncJsonsMutex;

extern "C" void watermelondbProvideSyncJson(int id, NSData *json, NSError **errorPtr) {
    const std::lock_guard<std::mutex> lock(providedSyncJsonsMutex);

    if (providedSyncJsons[@(id)]) {
        NSString *errorMsg = [NSString stringWithFormat:@"Sync json %i is already provided", id];
        *errorPtr = [NSError errorWithDomain:@"com.nozbe.watermelondb.error"
                                        code:-1
                                    userInfo:@{ @"NSLocalizedDescriptionKey": errorMsg }];
        return;
    }

    providedSyncJsons[@(id)] = json;
}

std::string_view getSyncJson(int id) {
    const std::lock_guard<std::mutex> lock(providedSyncJsonsMutex);

    NSData *json = providedSyncJsons[@(id)];
    if (!json) {
        throw std::runtime_error("Sync json " + std::to_string(id) + " does not exist");
    }
    std::string_view view((char *) json.bytes, json.length);
    return view;
}

void deleteSyncJson(int id) {
    const std::lock_guard<std::mutex> lock(providedSyncJsonsMutex);
    [providedSyncJsons removeObjectForKey: @(id)];
}

void onDestroy(std::function<void()> callback) {
    [NSNotificationCenter.defaultCenter addObserverForName:RCTBridgeWillReloadNotification
                                                    object:nil
                                                     queue:nil
                                                usingBlock: ^(NSNotification *note) {
        callback();
    }];
}

} // namespace platform
} // namespace watermelondb
