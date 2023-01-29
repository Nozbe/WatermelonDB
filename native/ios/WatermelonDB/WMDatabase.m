#import "WMDatabase.h"

@implementation WMDatabase {
    NSString *_path;
}

- (instancetype) initWithPath:(NSString *)path
{
    if (self = [super init]) {
        _path = path;
        _fmdb = [FMDatabase databaseWithPath:path];
    }
    
    return self;
}

+ (instancetype) databaseWithPath:(NSString *)path
{
    return [[self alloc] initWithPath:path];
}

- (void) open
{
    NSAssert([_fmdb open], @"Failed to open the database: %@", _fmdb.lastErrorMessage);
    
    // TODO: Configurable logger
    NSLog(@"Opened database at %@", _path);
}

#pragma mark - Querying

@end
