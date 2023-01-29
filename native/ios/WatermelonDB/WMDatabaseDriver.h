#import "WMDatabase.h"

NS_ASSUME_NONNULL_BEGIN

@interface WMDatabaseDriver : NSObject

@property (readwrite, strong, nonatomic) WMDatabase *db;
@property (readonly, strong, nonatomic) NSMutableDictionary<NSString *, NSMutableSet<NSString *> *> *cachedRecords;

@end

NS_ASSUME_NONNULL_END
