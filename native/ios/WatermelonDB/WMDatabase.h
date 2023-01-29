#import "FMDB.h"

NS_ASSUME_NONNULL_BEGIN

@interface WMDatabase : NSObject

@property (readwrite, strong, nonatomic) FMDatabase *fmdb;

@end

NS_ASSUME_NONNULL_END
