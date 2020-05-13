#include "DatabasePlatform.h"

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    // TODO: Unimplemented
}

void consoleError(std::string message) {
    // TODO: Unimplemented
}

std::string resolveDatabasePath(std::string path) {
    return path; // TODO: Unimplemented
}

void onMemoryAlert(std::function<void(void)> callback) {
    // TODO: Unimplemented
}

} // namespace platform
} // namespace watermelondb
