#include "DatabasePlatform.h"
#import <Foundation/Foundation.h>

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    NSLog(@"%s", message.c_str());
}

void consoleError(std::string message) {
    NSLog(@"Error: %s", message.c_str());
}

std::string resolveDatabasePath(std::string path) {
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

} // namespace platform
} // namespace watermelondb
