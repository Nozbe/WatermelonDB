#import "WMDatabase.h"

NS_ASSUME_NONNULL_BEGIN

@interface WMDatabaseDriver : NSObject

@property (readwrite, strong, nonatomic) WMDatabase *db;

@end

NS_ASSUME_NONNULL_END
