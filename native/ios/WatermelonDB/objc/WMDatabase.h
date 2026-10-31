#import "FMDB.h"

NS_ASSUME_NONNULL_BEGIN

@interface WMDatabase : NSObject

@property (readwrite, strong, nonatomic) FMDatabase *fmdb;
@property (readonly, nonatomic) long userVersion;

#pragma mark - Initialization

/// Returns nil (and sets errorPtr) if the database could not be opened
+ (nullable instancetype) databaseWithPath:(NSString *)path error:(NSError **)errorPtr;

#pragma mark - Executing queries

- (BOOL) executeQuery:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
/// Executes multiple queries separated by `;`
- (BOOL) executeStatements:(NSString *)sql error:(NSError **)errorPtr;
- (FMResultSet *) queryRaw:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
- (NSNumber * _Nullable) count:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;

#pragma mark - Other database functions

- (BOOL) inTransaction:(BOOL (^)(NSError**))transactionBlock error:(NSError**)errorPtr;
- (BOOL) setUserVersion:(long)userVersion error:(NSError **)errorPtr;
- (BOOL) unsafeDestroyEverything:(NSError**)errorPtr;

@end

NS_ASSUME_NONNULL_END
