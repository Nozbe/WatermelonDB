#import "FMDB.h"

NS_ASSUME_NONNULL_BEGIN

@interface WMDatabase : NSObject

@property (readwrite, strong, nonatomic) FMDatabase *fmdb;
@property (readwrite, nonatomic) long userVersion;

#pragma mark - Initialization

+ (instancetype) databaseWithPath:(NSString *)path;

#pragma mark - Executing queries

- (BOOL) executeQuery:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
/// Executes multiple queries separated by `;`
- (BOOL) executeStatements:(NSString *)sql error:(NSError **)errorPtr;
- (FMResultSet *) queryRaw:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
- (NSNumber * _Nullable) count:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;

#pragma mark - Other database functions

- (BOOL) inTransaction:(BOOL (^)(NSError**))transactionBlock error:(NSError**)errorPtr;
- (BOOL) unsafeDestroyEverything:(NSError**)errorPtr;

@end

NS_ASSUME_NONNULL_END
