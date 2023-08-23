#pragma once

#include <functional>
#include <string>
#include "Database.h"

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    // TODO: Unimplemented
}

void consoleError(std::string message) {
    // TODO: Unimplemented
}

void initializeSqlite() {
    // TODO: Unimplemented
}

std::string resolveDatabasePath(std::string path) {
    // TODO: Unimplemented
    return "";
}

void deleteDatabaseFile(std::string path, bool warnIfDoesNotExist) {
    // TODO: Unimplemented
}

void onMemoryAlert(std::function<void(void)> callback) {
    // TODO: Unimplemented
}

std::string_view getSyncJson(int id) {
    return "";
}

void deleteSyncJson(int id) {
    // TODO: Unimplemented
}

void onDestroy(std::function<void(void)> callback) {
    // TODO: Unimplemented
}

} // namespace platform
} // namespace watermelondb
