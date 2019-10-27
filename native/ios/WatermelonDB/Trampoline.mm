#import "Trampoline.h"

void jumpToDatabaseBatch(watermelondb::Database *db, jsi::Runtime& rt, jsi::Array& operations) {
    db->batch(rt, operations);
}
