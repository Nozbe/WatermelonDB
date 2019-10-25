#include "Database.h"

namespace watermelondb {

//void Database::executeUpdate() {
//    
//}

void Database::batch(jsi::Runtime& rt, jsi::Array& operations) {
    size_t operationsCount = operations.length(rt);
    for (size_t i = 0; i < operationsCount; i++) {
        jsi::Array operation = operations.getValueAtIndex(rt, i).asObject(rt).asArray(rt);
        std::string type = operation.getValueAtIndex(rt, 0).asString(rt).utf8(rt);

        if (type == "create") {
            std::string table = operation.getValueAtIndex(rt, 1).asString(rt).utf8(rt);
            std::string id = operation.getValueAtIndex(rt, 2).asString(rt).utf8(rt);
            std::string sql = operation.getValueAtIndex(rt, 3).asString(rt).utf8(rt);
            jsi::Array arguments = operation.getValueAtIndex(rt, 4).asObject(rt).asArray(rt);



        } else if (type == "execute") {
            throw jsi::JSError(rt, "Unimplemented");
        } else if (type == "markAsDeleted") {
            throw jsi::JSError(rt, "Unimplemented");
        } else if (type == "destroyPermanently") {
            throw jsi::JSError(rt, "Unimplemented");
        } else {
            throw jsi::JSError(rt, "Invalid operation type");
        }
    }
}

} // namespace watermelondb
